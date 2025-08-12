// vitrini-agendamento.js
// VERSÃO FINAL E COMPLETA - Firebase v10.12.2

import {
    collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './vitrini-firebase.js';
import { showAlert } from './vitrini-utils.js';

/**
 * Salva um novo agendamento na subcoleção da EMPRESA.
 */
export async function salvarAgendamento(empresaId, currentUser, agendamentoState) {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!currentUser || !agendamentoState.profissional || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
        if (btn) btn.disabled = false;
        await showAlert("Atenção", "Dados insuficientes para agendar. Verifique todas as seleções.");
        return;
    }

    try {
        const dataHoraString = `${agendamentoState.data}T${agendamentoState.horario}:00`;
        const dataAgendamento = new Date(dataHoraString);

        const dadosAgendamento = {
            clienteUid: currentUser.uid, clienteNome: currentUser.displayName, clienteEmail: currentUser.email,
            profissionalId: agendamentoState.profissional.id, profissionalNome: agendamentoState.profissional.nome,
            servicoId: agendamentoState.servico.id, servicoNome: agendamentoState.servico.nome, servicoDuracao: agendamentoState.servico.duracao, servicoPreco: agendamentoState.servico.preco,
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
            return todos.filter(ag => ag.horario.toDate() >= agora && ag.status === 'agendado').sort((a, b) => a.horario.toMillis() - b.horario.toMillis());
        } else {
            return todos.filter(ag => ag.horario.toDate() < agora || ag.status !== 'agendado').sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
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
    const q = query(agendRef, where("horario", ">=", Timestamp.fromDate(inicioDoDia)), where("horario", "<=", Timestamp.fromDate(fimDoDia)), where("status", "==", "agendado"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const ag = doc.data();
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (ag.servicoDuracao || 30) * 60000);
        return { inicio, fim, profissionalId: ag.profissionalId };
    });
}

/**
 * Função pura que calcula os slots de horário disponíveis.
 */
export function calcularSlotsDisponiveis(data, agendamentosOcupados, horariosConfig, duracaoServico) {
    const slotsDisponiveis = [];
    const diaDaSemanaNum = new Date(`${data}T12:00:00`).getDay();
    const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaDaSemanaNum];
    const configDia = horariosConfig?.[nomeDia];

    if (!configDia || !configDia.ativo || !configDia.blocos || !duracaoServico) {
        return [];
    }
    configDia.blocos.forEach(bloco => {
        let slotAtual = new Date(`${data}T${bloco.inicio}`);
        const fimBloco = new Date(`${data}T${bloco.fim}`);
        while (slotAtual < fimBloco) {
            const fimSlot = new Date(slotAtual.getTime() + duracaoServico * 60000);
            if (fimSlot > fimBloco) break;
            const estaOcupado = agendamentosOcupados.some(agendamento => (slotAtual < agendamento.fim && fimSlot > agendamento.inicio));
            if (!estaOcupado) {
                slotsDisponiveis.push(slotAtual.toTimeString().substring(0, 5));
            }
            slotAtual = new Date(slotAtual.getTime() + 15 * 60000); // Avança em intervalos de 15 min
        }
    });
    return slotsDisponiveis;
}

/**
 * Encontra a primeira data com horários disponíveis para um PROFISSIONAL específico.
 */
export async function encontrarPrimeiraDataComSlots(empresaId, profissional) {
    if (!profissional?.horarios || !profissional?.servicos?.length) {
        console.warn("Profissional sem horários ou serviços configurados para encontrar data.");
        return null;
    }
    
    // Supondo que profissional.servicos é um array de IDs. Precisamos dos objetos completos.
    // Esta parte depende que 'state.todosOsServicos' esteja disponível. 
    // Por isso, a lógica principal fica no vitrine.js, mas a função base está aqui.
    const primeiroServicoId = profissional.servicos[0];
    const duracaoBase = 30; // Padrão

    let dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0);

    for (let i = 0; i < 90; i++) {
        const diaSemana = dataAtual.getDay(); // diaSemana com 's' minúsculo
        const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
        const configDia = profissional.horarios[nomeDia];

        if (configDia && configDia.ativo && configDia.blocos?.length > 0) {
            const dataISO = dataAtual.toISOString().split('T')[0];
            const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataISO);
            const agendamentosDoProfissional = agendamentosDoDia.filter(ag => ag.profissionalId === profissional.id);
            const slotsDisponiveis = calcularSlotsDisponiveis(dataISO, agendamentosDoProfissional, profissional.horarios, duracaoBase);

            if (slotsDisponiveis.length > 0) {
                return dataISO; // Encontrou!
            }
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    console.warn("Nenhuma data com slots encontrada nos próximos 90 dias.");
    return null;
}
