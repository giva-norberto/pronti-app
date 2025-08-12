// VERSÃO FINAL - AGENDAMENTO COM INTERVALO GLOBAL E DADOS COMPATÍVEIS COM FIREBASE

import {
    collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './vitrini-firebase.js';
import { showAlert } from './vitrini-utils.js';

/**
 * Salva um novo agendamento na subcoleção da EMPRESA.
 * Validação rigorosa dos dados.
 */
export async function salvarAgendamento(empresaId, currentUser, agendamentoState) {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (
        !currentUser ||
        !agendamentoState.profissional ||
        !agendamentoState.servico ||
        !agendamentoState.data ||
        !agendamentoState.horario
    ) {
        if (btn) btn.disabled = false;
        await showAlert("Atenção", "Dados insuficientes para agendar. Verifique todas as seleções.");
        return;
    }

    try {
        const dataHoraString = `${agendamentoState.data}T${agendamentoState.horario}:00`;
        const dataAgendamento = new Date(dataHoraString);

        const dadosAgendamento = {
            clienteUid: currentUser.uid,
            clienteNome: currentUser.displayName,
            clienteEmail: currentUser.email,
            profissionalId: agendamentoState.profissional.id,
            profissionalNome: agendamentoState.profissional.nome,
            servicoId: agendamentoState.servico.id,
            servicoNome: agendamentoState.servico.nome,
            servicoDuracao: agendamentoState.servico.duracao,
            servicoPreco: agendamentoState.servico.preco,
            horario: Timestamp.fromDate(dataAgendamento),
            status: 'agendado'
        };

        await addDoc(collection(db, "empresarios", empresaId, "agendamentos"), dadosAgendamento);
        await showAlert("Sucesso!", "Seu agendamento foi realizado com sucesso.");
        location.reload();

    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        if (btn) btn.disabled = false;
        await showAlert("Erro", "Falha ao realizar o agendamento. Tente novamente.");
    }
}

/**
 * Busca os agendamentos de um cliente para uma determinada EMPRESA e os retorna.
 * Filtros claros para ativos e passados.
 */
export async function buscarAgendamentosDoCliente(empresaId, currentUser, modo = 'ativos') {
    if (!currentUser) return [];
    try {
        const agendRef = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(agendRef, where("clienteUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return [];

        const agora = new Date();
        const todos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (modo === 'ativos') {
            return todos.filter(ag => ag.horario.toDate() >= agora && ag.status === 'agendado')
                        .sort((a, b) => a.horario.toMillis() - b.horario.toMillis());
        } else {
            return todos.filter(ag => ag.horario.toDate() < agora || ag.status !== 'agendado')
                        .sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
        }
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        return [];
    }
}

/**
 * Cancela um agendamento na subcoleção da EMPRESA.
 */
export async function cancelarAgendamento(empresaId, agendamentoId, callback) {
    try {
        const agendamentoRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
        await updateDoc(agendamentoRef, { status: 'cancelado_pelo_cliente' });
        await showAlert("Sucesso", "Agendamento cancelado com sucesso.");
        if (callback) callback();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        await showAlert("Erro", "Ocorreu um erro ao cancelar. Tente novamente.");
    }
}

/**
 * Busca todos os agendamentos de um dia para uma EMPRESA.
 */
export async function buscarAgendamentosDoDia(empresaId, dataString) {
    const inicioDoDia = new Date(`${dataString}T00:00:00`);
    const fimDoDia = new Date(`${dataString}T23:59:59`);
    const agendRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(
        agendRef,
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia)),
        where("status", "==", "agendado")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const ag = doc.data();
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (ag.servicoDuracao || 30) * 60000);
        return { inicio, fim, profissionalId: ag.profissionalId };
    });
}

/**
 * Gera os slots disponíveis para um dia e profissional.
 * Respeita estrutura: intervalo global (horarios.intervalo), campo ativo, blocos, etc.
 * Se não existir intervalo global, usa 15 minutos.
 */
export function calcularSlotsDisponiveis(data, agendamentosOcupados, horariosConfig, duracaoServico, profissionalId) {
    const slotsDisponiveis = [];
    const diasNomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaDaSemana = new Date(`${data}T12:00:00`).getDay();
    const nomeDia = diasNomes[diaDaSemana];
    const diaConfig = horariosConfig?.[nomeDia];

    // Usa intervalo GLOBAL do objeto horariosConfig, se existir
    const intervaloGlobal = horariosConfig?.intervalo ? parseInt(horariosConfig.intervalo) : 15;

    if (!diaConfig?.ativo || !Array.isArray(diaConfig.blocos) || diaConfig.blocos.length === 0 || !duracaoServico) {
        return [];
    }
    diaConfig.blocos.forEach(bloco => {
        const intervaloMinutos = intervaloGlobal;
        let slotAtual = new Date(`${data}T${bloco.inicio}:00`);
        const fimBloco = new Date(`${data}T${bloco.fim}:00`);
        while (slotAtual < fimBloco) {
            const fimSlot = new Date(slotAtual.getTime() + duracaoServico * 60000);
            if (fimSlot > fimBloco) break;
            const estaOcupado = agendamentosOcupados
                .filter(ag => ag.profissionalId === profissionalId)
                .some(agendamento => (slotAtual < agendamento.fim && fimSlot > agendamento.inicio));
            if (!estaOcupado) {
                slotsDisponiveis.push(slotAtual.toTimeString().substring(0, 5));
            }
            slotAtual = new Date(slotAtual.getTime() + intervaloMinutos * 60000);
        }
    });
    return slotsDisponiveis;
}

/**
 * Encontra a primeira data com horários disponíveis, ou retorna hoje (mesmo sem slots).
 * Busca nos próximos 30 dias.
 * Precisa do serviço selecionado para a duração.
 */
export async function encontrarPrimeiraDataComSlotsOuHoje(empresaId, profissional, servicoSelecionado) {
    const duracaoBase = servicoSelecionado?.duracao || 30;
    let dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
        let dataBusca = new Date(dataAtual);
        dataBusca.setDate(dataAtual.getDate() + i);
        const dataISO = dataBusca.toISOString().split('T')[0];
        const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataISO);

        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataISO,
            agendamentosDoDia,
            profissional.horarios,
            duracaoBase,
            profissional.id
        );

        if (slotsDisponiveis.length > 0) {
            return { data: dataISO, slots: slotsDisponiveis };
        }
    }

    // Nenhum slot encontrado
    const dataISO = dataAtual.toISOString().split('T')[0];
    return { data: dataISO, slots: [] };
}

/**
 * Retrocompatibilidade: retorna apenas a data ou null se não houver slots.
 */
export async function encontrarPrimeiraDataComSlots(empresaId, profissional, servicoSelecionado) {
    const result = await encontrarPrimeiraDataComSlotsOuHoje(empresaId, profissional, servicoSelecionado);
    if (result && result.slots.length > 0) {
        return result.data;
    } else {
        return null;
    }
}
