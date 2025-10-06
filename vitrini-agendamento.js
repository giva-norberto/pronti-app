// ======================================================================
// vitrini-agendamento.js (REVISADO COM ENVIO DE E-MAIL)
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
// 🔔 INÍCIO DA ÚNICA PARTE ALTERADA: Função de envio de e-mail (VERSÃO DE TESTE FINAL)
// =====================================================================================
async function enviarEmailNotificacao(agendamento, currentUser) {
  console.log("Tentando enviar e-mail...");
  
  try {
    // A sua lógica para buscar o e-mail do dono está perfeita.
    if (!agendamento?.empresa?.emailDono && agendamento?.empresa?.donoId) {
      const donoRef = doc(db, "usuarios", agendamento.empresa.donoId);
      const donoSnap = await getDoc(donoRef);
      if (donoSnap.exists()) {
        agendamento.empresa.emailDono = donoSnap.data().email;
      }
    }

    if (!agendamento?.empresa?.emailDono) {
      console.warn("⚠️ E-mail do dono não encontrado. E-mail não enviado.");
      return;
    }

    // Usando a sua URL nova e funcional
    const scriptURL = "https://script.google.com/macros/s/AKfycbxZnP9b1fS6I-o4ore-P0OPVXnctLBvMRGiroVt7XPdLViPsqgA8ZY98dBeabz-lSju/exec";

    const payload = {
      destinatario: agendamento.empresa.emailDono,
      nomeCliente: currentUser.displayName,
      servico: agendamento.servico.nome,
      data: agendamento.data, // <--- Garantindo que a DATA está incluída
      horario: agendamento.horario
    };

    console.log("Payload a ser enviado:", JSON.stringify(payload));

    // A MUDANÇA ESTÁ AQUI: Adicionando mode: 'no-cors'
    // Isto diz ao navegador para "enviar e não se preocupar com a resposta".
    // É uma forma de contornar bloqueios de segurança que podem causar o "Failed to fetch".
    await fetch(scriptURL, {
      method: "POST",
      mode: 'no-cors', // <--- MUDANÇA IMPORTANTE PARA O TESTE
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // Como usamos 'no-cors', não podemos ler a resposta, mas o e-mail deve ser enviado.
    console.log("✅ Requisição de e-mail enviada! Verifique a sua caixa de entrada.");

  } catch (error) {
    // Com 'no-cors', o erro pode não ser capturado aqui, mas mantemos por segurança.
    console.error("❌ Erro no processo de envio de e-mail:", error);
  }
}
// =====================================================================================
// 🔔 FIM DA ÚNICA PARTE ALTERADA
// =====================================================================================


// ======================================================================
// 🔧 Lógica principal de salvamento de agendamento (LÓGICA 100% PRESERVADA)
// ======================================================================
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
