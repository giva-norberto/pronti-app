// ======================================================================
// vitrine-pets-agendamento.js (LÓGICA ESPECÍFICA PARA AGENDAMENTO DE PETS)
// ======================================================================

/*
  DIFERENÇAS PRINCIPAIS PARA PETS:
  - Cliente seleciona ou cadastra o PET antes do serviço.
  - Serviço PET tem um array de preços por porte.
  - Porte do animal é obrigatório na criação de agendamento.
  - Profissional continua opcional (se existir).
  - Mantém checagem de ausências do profissional.
  - Preço/duração é recuperado pelo porte do pet (não campo direto).
*/

import { db } from './vitrini-firebase.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { limparUIAgendamento } from './vitrine-pets-ui.js'; // UI específica para pets

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

function getLocalYYYYMMDD(dateObj = new Date()) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// -------------------------------------------------------------------------
// Checagem de Ausências do Profissional (igual ao padrão)
// -------------------------------------------------------------------------
export async function profissionalTemAusencia(empresaId, profissionalId, dataYYYYMMDD) {
    try {
        if (!empresaId || !profissionalId || !dataYYYYMMDD) return false;
        const ausRef = collection(db, 'empresarios', empresaId, 'profissionais', profissionalId, 'ausencias');
        const q = query(ausRef, where('data', '==', dataYYYYMMDD));
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (err) {
        console.warn('Erro ao verificar ausência do profissional:', err);
        return false;
    }
}

// --- Busca de Agendamentos no dia (igual ao padrão) --
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

// --- Slots Disponíveis: igual, mas recebe DURAÇÃO do serviço PET já calculada --
export function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00Z`);
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
    const ehHoje = getLocalYYYYMMDD(hoje) === data;
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

            if (!temConflito && (!ehHoje || slotAtualEmMinutos > minutosAgora)) {
                slotsDisponiveis.push(minutesToTimeString(slotAtualEmMinutos));
            }
            slotAtualEmMinutos += intervaloEntreSessoes || duracaoServico;
        }
    }
    return slotsDisponiveis;
}

// --- Busca da PRIMEIRA DATA com slots, respeitando ausências --
export async function encontrarPrimeiraDataComSlots(empresaId, profissional, duracaoServico) {
    const hoje = new Date();
    for (let i = 0; i < 90; i++) {
        const dataAtual = new Date(hoje);
        dataAtual.setDate(hoje.getDate() + i);
        const dataString = getLocalYYYYMMDD(dataAtual);
        const estaAusente = await profissionalTemAusencia(empresaId, profissional.id, dataString);
        if (estaAusente) continue;
        const agendamentos = await buscarAgendamentosDoDia(empresaId, dataString);
        const agendamentosProfissional = agendamentos.filter(ag => ag.profissionalId === profissional.id);
        const slots = calcularSlotsDisponiveis(dataString, agendamentosProfissional, profissional.horarios, duracaoServico);
        if (slots.length > 0) {
            return dataString;
        }
    }
    return null;
}

// =============================================================================
// 🔧 Lógica principal de salvamento de agendamento PET
// =============================================================================
export async function salvarAgendamentoPet(empresaId, currentUser, agendamento) {
    try {
        // REGRA PET: exigir PET e porte
        if (!agendamento.petId || !agendamento.porte) {
            throw new Error("É obrigatório selecionar o pet e o porte do animal para agendar.");
        }

        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        // Calcular preço/duração a partir do serviço PET selecionado e porte do animal
        // No formato: servico.precos = [{porte, preco, duracao}]
        const servicoObj = agendamento.servico;
        let infoDoServicoPorte;
        if (Array.isArray(servicoObj.precos)) {
            infoDoServicoPorte = servicoObj.precos.find(p => p.porte === agendamento.porte);
            if (!infoDoServicoPorte) throw new Error("O serviço selecionado não possui preço/duração para o porte escolhido.");
        } else {
            throw new Error("Serviço selecionado não está no formato PET (array de preços/porte).");
        }

        const precoCobrado = Number(infoDoServicoPorte.preco) || 0;
        const duracaoServico = Number(infoDoServicoPorte.duracao) || 30;

        const payload = {
            empresaId: empresaId,
            clienteId: currentUser.uid,
            clienteNome: currentUser.displayName,
            clienteFoto: currentUser.photoURL,
            petId: agendamento.petId,
            petNome: agendamento.petNome,
            porte: agendamento.porte,
            profissionalId: agendamento.profissional?.id || null,
            profissionalNome: agendamento.profissional?.nome || null,
            servicoId: servicoObj.id,
            servicoNome: servicoObj.nome,
            servicoDuracao: duracaoServico,
            servicoPrecoCobrado: precoCobrado,
            data: agendamento.data,
            horario: agendamento.horario,
            status: 'ativo',
            criadoEm: serverTimestamp()
        };

        if (agendamento.assinaturaConsumo) {
            payload.assinaturaConsumo = agendamento.assinaturaConsumo;
            payload.origemPagamento = 'assinatura';
        }

        await addDoc(agendamentosRef, payload);

        // Notificações (igual padrão)
        if (agendamento.empresa && agendamento.empresa.donoId) {
            try {
                const filaRef = collection(db, "filaDeNotificacoes");
                await addDoc(filaRef, {
                    donoId: agendamento.empresa.donoId,
                    titulo: "🐾 Novo Agendamento PET!",
                    mensagem: `${currentUser.displayName} agendou ${servicoObj.nome} para ${agendamento.petNome} (${agendamento.porte}) às ${agendamento.horario}.`,
                    criadoEm: new Date(),
                    status: "pendente"
                });
                await addDoc(filaRef, {
                    donoId: currentUser.uid,
                    titulo: "✅ Agendamento PET Confirmado!",
                    mensagem: `Seu pet ${agendamento.petNome} foi agendado para ${servicoObj.nome} (${agendamento.porte}) em ${agendamento.data} às ${agendamento.horario}.`,
                    criadoEm: new Date(),
                    status: "pendente"
                });
            } catch (error) {
                console.error("❌ Erro ao adicionar notificações à fila PET:", error);
            }
        }

        if (typeof limparUIAgendamento === "function") {
            limparUIAgendamento();
        }

    } catch (error) {
        console.error("Erro principal ao salvar agendamento PET:", error);
        throw new Error('Ocorreu um erro ao confirmar seu agendamento PET.');
    }
}

// --- Funções de busca/cancelamento mantidas igual às originais ---
export async function buscarAgendamentosDoClientePets(empresaId, currentUser, modo) {
    if (!currentUser) return [];
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        const hoje = getLocalYYYYMMDD();

        let q;
        if (modo === 'ativos') {
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("status", "==", "ativo"),
                where("data", ">=", hoje)
            );
        } else {
            q = query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("data", "<", hoje)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente PET:", error);
        if (error.code === 'failed-precondition' && error.message.includes("The query requires an index")) {
            throw new Error("Ocorreu um erro ao buscar seus agendamentos PET. A configuração do banco de dados pode estar incompleta (índice composto).");
        }
        throw error;
    }
}

export async function cancelarAgendamentoPets(empresaId, agendamentoId) {
    try {
        const agendamentoRef = doc(db, 'empresarios', empresaId, 'agendamentos', agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelado_pelo_cliente',
            canceladoEm: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao cancelar agendamento PET:", error);
        throw new Error("Ocorreu um erro ao cancelar o agendamento do pet.");
    }
}
