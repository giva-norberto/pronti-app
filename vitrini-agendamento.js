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

// --- Funções Auxiliares de Tempo ---
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
 * @param {string} empresaId - O ID da empresa.
 * @param {string} data - A data no formato "AAAA-MM-DD".
 * @returns {Promise<Array>} Lista de agendamentos do dia.
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
        return [];
    }
}

/**
 * Calcula os horários (slots) disponíveis para um agendamento.
 */
export function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00`);
    const nomeDia = diaDaSemana[dataObj.getDay()];

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

    for (const bloco of diaDeTrabalho.blocos) {
        let slotAtualEmMinutos = timeStringToMinutes(bloco.inicio);
        const fimDoBlocoEmMinutos = timeStringToMinutes(bloco.fim);

        while (slotAtualEmMinutos + duracaoServico <= fimDoBlocoEmMinutos) {
            const fimDoSlotProposto = slotAtualEmMinutos + duracaoServico;
            let temConflito = horariosOcupados.some(ocupado =>
                slotAtualEmMinutos < ocupado.fim && fimDoSlotProposto > ocupado.inicio
            );

            if (!temConflito) {
                slotsDisponiveis.push(minutesToTimeString(slotAtualEmMinutos));
            }
            slotAtualEmMinutos += intervaloEntreSessoes;
        }
    }
    return slotsDisponiveis;
}

/**
 * Tenta encontrar a próxima data com horários disponíveis, a partir de hoje.
 */
export async function encontrarPrimeiraDataComSlots(empresaId, profissional) {
    const hoje = new Date();
    for (let i = 0; i < 90; i++) { // Procura nos próximos 90 dias
        const dataAtual = new Date(hoje);
        dataAtual.setDate(hoje.getDate() + i);
        const dataString = dataAtual.toISOString().split('T')[0];

        const agendamentos = await buscarAgendamentosDoDia(empresaId, dataString);
        const agendamentosProfissional = agendamentos.filter(ag => ag.profissionalId === profissional.id);

        // Assumindo que o primeiro serviço da lista é representativo
        // O ideal seria passar um serviço aqui, mas para uma busca inicial funciona
        const duracaoTeste = 30; // Usamos uma duração padrão para procurar

        const slots = calcularSlotsDisponiveis(dataString, agendamentosProfissional, profissional.horarios, duracaoTeste);

        if (slots.length > 0) {
            return dataString; // Encontrou! Retorna a data.
        }
    }
    return null; // Não encontrou nenhuma data nos próximos 90 dias
}

/**
 * Salva um novo agendamento no banco de dados.
 */
export async function salvarAgendamento(empresaId, currentUser, agendamento) {
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        await addDoc(agendamentosRef, {
            empresaId: empresaId,
            clienteId: currentUser.uid,
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
        alert('Agendamento confirmado com sucesso!');
        window.location.reload(); // Recarrega a página para limpar a seleção
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        alert('Ocorreu um erro ao confirmar seu agendamento.');
    }
}

/**
 * Busca os agendamentos de um cliente específico.
 * OBS: Caso consulte por mais de um campo (clienteId, status, data), Firestore exige índice composto!
 */
export async function buscarAgendamentosDoCliente(empresaId, currentUser, modo) {
    if (!currentUser) return [];
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        const hoje = new Date().toISOString().split('T')[0];

        let q;
        if (modo === 'ativos') {
            // Precisa de índice composto: clienteId + status + data
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("status", "==", "ativo"),
                where("data", ">=", hoje)
            );
        } else { // historico
            // Precisa de índice composto: clienteId + data
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("data", "<", hoje)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        // Se erro de índice, mostra instrução clara para o dev/admin
        if (
            error.name === "FirebaseError" &&
            error.message.includes("The query requires an index") &&
            error.message.includes("firestore/indexes?create_composite=")
        ) {
            const link = error.message.match(/https:\/\/console\.firebase\.google\.com\/[^\s"]+/)?.[0];
            alert(
                "Sua consulta precisa de um índice no Firestore.\n\n" +
                (link ? `Clique para criar o índice:\n${link}\n\nDepois de criar, recarregue a página.` : "Copie o link do erro para criar o índice no Firebase.")
            );
        }
        console.error("Erro ao buscar agendamentos do cliente:", error);
        return [];
    }
}

/**
 * Cancela um agendamento (muda o status para 'cancelado').
 */
export async function cancelarAgendamento(empresaId, agendamentoId, callback) {
    try {
        const agendamentoRef = doc(db, 'empresarios', empresaId, 'agendamentos', agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelado'
        });
        alert("Agendamento cancelado.");
        if (callback) callback();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        alert("Ocorreu um erro ao cancelar.");
    }
}
