import { db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Funções Auxiliares de Tempo (Mantidas) ---
function timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// --- Funções Principais de Agendamento ---

/**
 * Busca todos os agendamentos de uma empresa em uma data específica.
 */
export async function buscarAgendamentosDoDia(empresaId, data) {
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        const q = query(
            agendamentosRef,
            where("data", "==", data),
            where("status", "==", "ativo")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        throw new Error("Não foi possível buscar os agendamentos do dia.");
    }
}

/**
 * Calcula os horários (slots) disponíveis para um agendamento.
 */
export function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00Z`); // Adicionado Z para UTC e evitar problemas de fuso horário
    const nomeDia = diaDaSemana[dataObj.getUTCDay()];

    const diaDeTrabalho = horariosTrabalho?.[nomeDia];
    if (!diaDeTrabalho || !diaDeTrabalho.ativo || !diaDeTrabalho.blocos || diaDeTrabalho.blocos.length === 0) {
        return [];
    }

    const intervaloEntreSessoes = horariosTrabalho.intervalo || 0;
    const slotsDisponiveis = [];

    const horariosOcupados = agendamentosDoDia.map(ag => {
        const inicio = timeStringToMinutes(ag.horario);
        const fim = inicio + ag.servicoDuracao;
        return { inicio, fim };
    });

    const hoje = new Date();
    const ehHoje = hoje.getUTCFullYear() === dataObj.getUTCFullYear() &&
                   hoje.getUTCMonth() === dataObj.getUTCMonth() &&
                   hoje.getUTCDate() === dataObj.getUTCDate();
                   
    const minutosAgora = timeStringToMinutes(
        `${hoje.getHours().toString().padStart(2, '0')}:${hoje.getMinutes().toString().padStart(2, '0')}`
    );

    for (const bloco of diaDeTrabalho.blocos) {
        let slotAtualEmMinutos = timeStringToMinutes(bloco.inicio);
        const fimDoBlocoEmMinutos = timeStringToMinutes(bloco.fim);

        while (slotAtualEmMinutos + duracaoServico <= fimDoBlocoEmMinutos) {
            const fimDoSlotProposto = slotAtualEmMinutos + duracaoServico;
            let temConflito = horariosOcupados.some(ocupado =>
                slotAtualEmMinutos < ocupado.fim && fimDoSlotProposto > ocupado.inicio
            );

            if (
                !temConflito &&
                (!ehHoje || slotAtualEmMinutos > minutosAgora)
            ) {
                slotsDisponiveis.push(minutesToTimeString(slotAtualEmMinutos));
            }
            slotAtualEmMinutos += intervaloEntreSessoes;
        }
    }
    return slotsDisponiveis;
}

/**
 * Tenta encontrar a próxima data com horários disponíveis.
 */
export async function encontrarPrimeiraDataComSlots(empresaId, profissional, duracaoServico) {
    const hoje = new Date();
    for (let i = 0; i < 90; i++) { // Procura nos próximos 90 dias
        const dataAtual = new Date(hoje);
        dataAtual.setDate(hoje.getDate() + i);
        const dataString = dataAtual.toISOString().split('T')[0];

        const agendamentos = await buscarAgendamentosDoDia(empresaId, dataString);
        const agendamentosProfissional = agendamentos.filter(ag => ag.profissionalId === profissional.id);

        const slots = calcularSlotsDisponiveis(dataString, agendamentosProfissional, profissional.horarios, duracaoServico);

        if (slots.length > 0) {
            return dataString; // Encontrou! Retorna a data.
        }
    }
    return null; // Não encontrou nenhuma data nos próximos 90 dias
}

/**
 * Salva um novo agendamento no banco de dados. (SILENCIOSA)
 */
export async function salvarAgendamento(empresaId, currentUser, agendamento) {
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        await addDoc(agendamentosRef, {
            empresaId: empresaId,
            clienteId: currentUser.uid, // REVISADO: Mantido como 'clienteId' para compatibilidade
            clienteNome: currentUser.displayName,
            clienteFoto: currentUser.photoURL,
            profissionalId: agendamento.profissional.id,
            profissionalNome: agendamento.profissional.nome,
            servicoId: agendamento.servico.id,
            servicoNome: agendamento.servico.nome,
            servicoDuracao: agendamento.servico.duracao,
            servicoPreco: agendamento.servico.preco,
            data: agendamento.data,
            horario: agendamento.horario,
            status: 'ativo',
            criadoEm: serverTimestamp()
        });
        // Mensagem removida daqui para ser controlada pelo vitrine.js
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        throw new Error('Ocorreu um erro ao confirmar seu agendamento.');
    }
}

/**
 * Busca os agendamentos de um cliente específico.
 */
export async function buscarAgendamentosDoCliente(empresaId, currentUser, modo) {
    if (!currentUser) return [];
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        const hoje = new Date().toISOString().split('T')[0];
        let q;
        if (modo === 'ativos') {
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid), // REVISADO: Mantido como 'clienteId'
                where("status", "==", "ativo"),
                where("data", ">=", hoje)
            );
        } else { // historico
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid), // REVISADO: Mantido como 'clienteId'
                where("data", "<", hoje)
            );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        if (error.code === 'failed-precondition' && error.message.includes("The query requires an index")) {
            console.error("ERRO DE ÍNDICE COMPOSTO NO FIRESTORE:", error.message);
            throw new Error("Ocorreu um erro ao buscar seus agendamentos. Pode ser necessário configurar o banco de dados.");
        }
        console.error("Erro ao buscar agendamentos do cliente:", error);
        return [];
    }
}

/**
 * Cancela um agendamento (muda o status). (SILENCIOSA)
 */
export async function cancelarAgendamento(empresaId, agendamentoId) {
    try {
        const agendamentoRef = doc(db, 'empresarios', empresaId, 'agendamentos', agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelado_pelo_cliente'
        });
        // Mensagem removida daqui
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        throw new Error("Ocorreu um erro ao cancelar o agendamento.");
    }
}
