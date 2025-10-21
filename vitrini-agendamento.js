// ======================================================================
// vitrini-agendamento.js (REVISADO COM ENVIO DE E-MAIL E CAMPOS DE ASSINATURA NO AGENDAMENTO)
// ======================================================================

// ✅ Conexão correta da vitrine
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
import { limparUIAgendamento } from './vitrini-ui.js';

// --- Funções Auxiliares de Tempo (LÓGICA 100% PRESERVADA) ---
function timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// --- Funções Principais de Agendamento (LÓGICA 100% PRESERVADA) ---
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

            if (!temConflito && (!ehHoje || slotAtualEmMinutos > minutosAgora)) {
                slotsDisponiveis.push(minutesToTimeString(slotAtualEmMinutos));
            }
            slotAtualEmMinutos += intervaloEntreSessoes || duracaoServico;
        }
    }
    return slotsDisponiveis;
}

export async function encontrarPrimeiraDataComSlots(empresaId, profissional, duracaoServico) {
    const hoje = new Date();
    for (let i = 0; i < 90; i++) {
        const dataAtual = new Date(hoje);
        dataAtual.setDate(hoje.getDate() + i);
        const dataString = dataAtual.toISOString().split('T')[0];

        const agendamentos = await buscarAgendamentosDoDia(empresaId, dataString);
        const agendamentosProfissional = agendamentos.filter(ag => ag.profissionalId === profissional.id);

        const slots = calcularSlotsDisponiveis(dataString, agendamentosProfissional, profissional.horarios, duracaoServico);

        if (slots.length > 0) {
            return dataString;
        }
    }
    return null;
}

// =====================================================================================
// 🔔 INÍCIO DA ÚNICA FUNÇÃO ALTERADA (Lógica do E-mail)
// =====================================================================================
async function enviarEmailNotificacao(agendamento, currentUser) {
    console.log("Tentando enviar e-mail...");
    
    try {
        // CORREÇÃO: Buscar o e-mail de notificação diretamente do objeto da empresa,
        // que já foi carregado e passado no objeto 'agendamento'.
        // Isso evita a leitura da coleção /usuarios e o erro de permissão.
        const emailDoDono = agendamento?.empresa?.emailDeNotificacao;

        if (!emailDoDono) {
            // Se o campo 'emailDeNotificacao' não foi preenchido no perfil da empresa,
            // o e-mail não será enviado.
            console.warn("⚠️ E-mail do dono (emailDeNotificacao) não encontrado no documento da empresa. E-mail não enviado.");
            return; // Interrompe a função silenciosamente.
        }

        // Esta é a sua lógica original para enviar o e-mail
        // (Usando a coleção /mail, o que está correto)
        await addDoc(collection(db, "mail"), {
            to: emailDoDono, // Usa o e-mail correto
            template: {
                name: 'novoAgendamento', // (Certifique-se que o nome do template está correto)
                data: {
                    nomeCliente: currentUser.displayName || currentUser.email,
                    servicoNome: agendamento.servico.nome,
                    dataAgendamento: agendamento.data,
                    horarioAgendamento: agendamento.horario,
                    profissionalNome: agendamento.profissional.nome,
                    nomeEmpresa: agendamento.empresa.nomeFantasia
                }
            }
        });

        console.log("✅ E-mail para o dono adicionado à fila.");

    } catch (error) {
        // Se a escrita na coleção /mail falhar (o que não deve, pois a regra 'allow create: if request.auth != null' permite)
        // o erro será capturado aqui.
        console.error("❌ Erro no processo de envio de e-mail:", error);
    }
}
// =====================================================================================
// 🔔 FIM DA ÚNICA FUNÇÃO ALTERADA
// =====================================================================================


// ======================================================================
// 🔧 Lógica principal de salvamento de agendamento (SUA LÓGICA ORIGINAL)
// ======================================================================
export async function salvarAgendamento(empresaId, currentUser, agendamento) {
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');

        // Preservar valores originais e garantir campos novos para relatórios:
        const precoOriginal = agendamento?.servico?.precoOriginal != null
            ? Number(agendamento.servico.precoOriginal)
            : (agendamento?.servico?.preco != null ? Number(agendamento.servico.preco) : 0);

        const precoCobrado = agendamento?.servico?.precoCobrado != null
            ? Number(agendamento.servico.precoCobrado)
            : precoOriginal;

        // Monta o payload incluindo os novos campos:
        const payload = {
            empresaId: empresaId,
            clienteId: currentUser.uid,
            clienteNome: currentUser.displayName,
            clienteFoto: currentUser.photoURL,
            profissionalId: agendamento.profissional.id,
            profissionalNome: agendamento.profissional.nome,
            servicoId: agendamento.servico.id,
            servicoNome: agendamento.servico.nome,
            servicoDuracao: agendamento.servico.duracao,
            // campos novos para relatórios e rastreio de origem de pagamento
            servicoPrecoOriginal: precoOriginal,
            servicoPrecoCobrado: precoCobrado,
            data: agendamento.data,
            horario: agendamento.horario,
            status: 'ativo',
            criadoEm: serverTimestamp()
        };

        // Se o agendamento veio de consumo de assinatura, preserve o consumo/auditoria
        if (agendamento.assinaturaConsumo) {
            payload.assinaturaConsumo = agendamento.assinaturaConsumo; // ex: [{assinaturaId, servicoId, quantidade, planoNome}]
            payload.origemPagamento = 'assinatura';
        }

        await addDoc(agendamentosRef, payload);

        if (agendamento.empresa && agendamento.empresa.donoId) {
            try {
                const filaRef = collection(db, "filaDeNotificacoes");
                await addDoc(filaRef, {
                    donoId: agendamento.empresa.donoId,
                    titulo: "🎉 Novo Agendamento!",
                    mensagem: `${currentUser.displayName} agendou ${agendamento.servico.nome} com ${agendamento.profissional.nome} às ${agendamento.horario}.`,
                    criadoEm: new Date(),
                    status: "pendente"
                });
                console.log("✅ Bilhete de notificação adicionado à fila.");
            } catch (error) {
                console.error("❌ Erro ao adicionar notificação à fila:", error);
            }
        } else {
            console.warn("AVISO: 'donoId' não foi passado para salvarAgendamento. O bilhete de notificação não foi criado.");
        }

        // --- 💌 Envia o e-mail automático ---
        await enviarEmailNotificacao(agendamento, currentUser);

        if (typeof limparUIAgendamento === "function") {
            limparUIAgendamento();
        }

    } catch (error) {
        console.error("Erro principal ao salvar agendamento:", error);
        throw new Error('Ocorreu um erro ao confirmar seu agendamento.');
    }
}

// --- Funções de busca e cancelamento (LÓGICA 100% PRESERVADA) ---
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
        console.error("Erro ao buscar agendamentos do cliente:", error);
        if (error.code === 'failed-precondition' && error.message.includes("The query requires an index")) {
            throw new Error("Ocorreu um erro ao buscar seus agendamentos. A configuração do banco de dados pode estar incompleta (índice composto).");
        }
        throw error;
    }
}

export async function cancelarAgendamento(empresaId, agendamentoId) {
    try {
        const agendamentoRef = doc(db, 'empresarios', empresaId, 'agendamentos', agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelado_pelo_cliente',
            canceladoEm: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        throw new Error("Ocorreu um erro ao cancelar o agendamento.");
    }
}
