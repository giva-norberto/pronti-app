// ======================================================================
// vitrini-agendamento.js (VERSÃO ORIGINAL)
// ✅ ADICIONADA A FUNÇÃO DE NOTIFICAÇÃO SEM ALTERAR A LÓGICA EXISTENTE
// ======================================================================

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
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { limparUIAgendamento } from './vitrini-ui.js';

// --- Funções Auxiliares de Tempo ---
function timeStringToMinutes(timeStr  ) {
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
        // Lança o erro para que a função que chamou possa tratá-lo
        throw new Error("Não foi possível buscar os agendamentos do dia.");
    }
}

/**
 * Calcula os horários (slots) disponíveis para um agendamento.
 * REFINADO: Não mostra horários passados se a data for hoje.
 */
export function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00Z`); // Usar Z para tratar como UTC
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
    const ehHoje = hoje.toISOString().split('T')[0] === data;
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
            // Garante que o loop avance mesmo sem intervalo
            slotAtualEmMinutos += intervaloEntreSessoes || duracaoServico;
        }
    }
    return slotsDisponiveis;
}

/**
 * Tenta encontrar a próxima data com horários disponíveis, a partir de hoje.
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
 * Salva um novo agendamento no banco de dados. (REVISADO: SILENCIOSO)
 * ✅ ADIÇÃO: Após salvar, chama a função para notificar o dono via PHP.
 */
export async function salvarAgendamento(empresaId, currentUser, agendamento) {
    try {
        // --- LÓGICA ORIGINAL (INTACTA) ---
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

        // --- LÓGICA DE NOTIFICAÇÃO (ADICIONADA) ---
        // Esta parte só executa DEPOIS que o agendamento foi salvo com sucesso.
        // Ela verifica se a informação necessária ('donoId') foi passada.
        if (agendamento.empresa && agendamento.empresa.donoId) {
            await enviarNotificacaoNovoAgendamento(
                empresaId,
                agendamento.empresa.donoId,
                `🎉 Novo Agendamento!`,
                `${currentUser.displayName} agendou ${agendamento.servico.nome} com ${agendamento.profissional.nome} às ${agendamento.horario}.`
            );
        } else {
            // Este aviso ajuda a depurar se o 'donoId' não for passado pelo 'vitrine.js'
            console.warn("AVISO: 'donoId' não encontrado no objeto do agendamento. A notificação não foi enviada.");
        }

        // --- LÓGICA ORIGINAL (INTACTA) ---
        if (typeof limparUIAgendamento === "function") {
            limparUIAgendamento();
        }
        
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        throw new Error('Ocorreu um erro ao confirmar seu agendamento.');
    }
}

/**
 * ✅ NOVA FUNÇÃO: Envia os dados para o script PHP que dispara a notificação.
 * Esta função é nova e não altera nenhuma outra parte do seu código.
 */
async function enviarNotificacaoNovoAgendamento(empresaId, donoId, titulo, mensagem) {
    // =================================================================================
    // O erro "Failed to fetch" que você está vendo acontece por causa desta URL
    // ou de um bloqueio de rede (Firewall/CORS). A solução está no seu ambiente,
    // não neste código.
    //
    // PARA RESOLVER:
    // 1. Verifique se esta URL está 100% correta.
    // 2. Teste a URL diretamente no seu navegador.
    // 3. Se a URL funcionar mas o erro persistir, adicione `header("Access-Control-Allow-Origin: *");` ao seu script PHP.
    // 4. Se a URL for bloqueada pelo FortiGuard, teste em uma rede 4G/5G.
    // =================================================================================
    const PHP_NOTIFICATION_SCRIPT_URL = 'https://prontiapp.com.br/send_notification.php'; 

    const formData = new FormData( );
    formData.append('empresaId', empresaId);
    formData.append('donoId', donoId);
    formData.append('titulo', titulo);
    formData.append('mensagem', mensagem);

    try {
        const response = await fetch(PHP_NOTIFICATION_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            console.error(`Erro do servidor ao chamar script de notificação: ${response.status} ${response.statusText}`);
            return;
        }

        const result = await response.json();

        if (result.success) {
            console.log("Notificação de novo agendamento enviada com sucesso via PHP:", result);
        } else {
            console.error("Erro retornado pelo script PHP de notificação:", result.error);
        }
    } catch (error) {
        console.error("Erro de rede ou na chamada ao script PHP de notificação:", error);
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
                where("clienteId", "==", currentUser.uid),
                where("status", "==", "ativo"),
                where("data", ">=", hoje)
            );
        } else { // historico
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("data", "<", hoje)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        if (error.code === 'failed-precondition' && error.message.includes("The query requires an index")) {
             throw new Error("Ocorreu um erro ao buscar seus agendamentos. A configuração do banco de dados pode estar incompleta (índice composto).");
        }
        throw error;
    }
}

/**
 * Cancela um agendamento (muda o status para 'cancelado'). (REVISADO: SILENCIOSO)
 */
export async function cancelarAgendamento(empresaId, agendamentoId) {
    try {
        const agendamentoRef = doc(db, 'empresarios', empresaId, 'agendamentos', agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelado_pelo_cliente',
            canceladoEm: serverTimestamp()
        });
        // Mensagem removida para ser controlada pelo vitrine.js
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        throw new Error("Ocorreu um erro ao cancelar o agendamento.");
    }
}
