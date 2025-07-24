/**
 * agenda.js (Painel do Dono - Lógica Corrigida com Multi-Usuário)
 * * Este script contém a correção para o botão de cancelar,
 * * mantendo a camada de segurança para múltiplos usuários e
 * * as funções e fórmulas originais de carregamento de agendamentos.
 */

import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaAgendamentos = document.getElementById("lista-agendamentos");
const inputData = document.getElementById("data-agenda");

// Elementos do Modal de Confirmação
const modalConfirmacao = document.getElementById('modal-confirmacao');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const modalMensagem = document.getElementById('modal-mensagem');

let agendamentoParaCancelarId = null; // Variável para armazenar o ID do agendamento a ser cancelado
let currentUid = null; // Variável para armazenar o UID do usuário logado

// --- FUNÇÕES DE LÓGICA DA AGENDA ---

function formatarHorario(dataIso) {
  const data = new Date(dataIso);
  // Formata para "dd/mm/aaaa HH:MM"
  return data.toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function carregarAgendamentos(uid) {
  if (!uid) {
    console.error("UID do usuário não fornecido para carregar agendamentos.");
    return;
  }

  currentUid = uid; // Armazena o UID do usuário logado
  listaAgendamentos.innerHTML = "<p>Carregando agendamentos...</p>";

  const dataSelecionada = inputData.value;
  if (!dataSelecionada) {
    listaAgendamentos.innerHTML = "<p>Por favor, selecione uma data.</p>";
    return;
  }

  try {
    const colecao = collection(db, `users/${uid}/agendamentos`);
    const snapshot = await getDocs(colecao);
    const agendamentos = [];

    for (const docAg of snapshot.docs) {
      const ag = docAg.data();
      const dataAg = new Date(ag.horario);
      const dataAgFormatada = dataAg.toISOString().split("T")[0];

      if (dataAgFormatada === dataSelecionada && ag.status !== 'cancelado') {
        ag.id = docAg.id;

        const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
        ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço não encontrado";

        agendamentos.push(ag);
      }
    }

    if (agendamentos.length === 0) {
      const dataObj = new Date(dataSelecionada + 'T12:00:00');
      const dataFormatada = dataObj.toLocaleDateString('pt-BR');
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado para o dia ${dataFormatada}.</p>`;
    } else {
      listaAgendamentos.innerHTML = "";
      agendamentos.sort((a, b) => new Date(a.horario) - new Date(b.horario));

      agendamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item";

        // ✅ CÓDIGO CORRIGIDO: Adicionado class e data-id ao botão para torná-lo funcional.
        div.innerHTML = `
          <h3>${ag.servicoNome}</h3>
          <p><strong>Cliente:</strong> ${ag.cliente}</p>
          <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
          <button class="btn-cancelar-agendamento" data-id="${ag.id}">Cancelar Agendamento</button>
        `;

        listaAgendamentos.appendChild(div);
      });

      document.querySelectorAll('.btn-cancelar-agendamento').forEach(button => {
        button.addEventListener('click', (event) => {
          agendamentoParaCancelarId = event.target.dataset.id;
          modalMensagem.textContent = "Você tem certeza que deseja cancelar este agendamento?";
          modalConfirmacao.style.display = 'flex';
        });
      });
    }
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    listaAgendamentos.innerHTML = `<p style="color:red">Erro ao carregar agendamentos.</p>`;
  }
}

async function cancelarAgendamentoFirebase(agendamentoId, uid) {
  if (!uid || !agendamentoId) {
    Toastify({ text: "Erro: Informações incompletas para cancelar.", duration: 3000, backgroundColor: "#FF6347" }).showToast();
    return;
  }

  try {
    const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
    await updateDoc(agendamentoRef, { status: 'cancelado' });

    Toastify({ text: "Agendamento cancelado com sucesso!", duration: 3000, backgroundColor: "#4CAF50" }).showToast();
    carregarAgendamentos(uid);
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    Toastify({ text: "Erro ao cancelar agendamento.", duration: 3000, backgroundColor: "#FF6347" }).showToast();
  } finally {
    fecharModalConfirmacao();
  }
}

function fecharModalConfirmacao() {
  modalConfirmacao.style.display = 'none';
  agendamentoParaCancelarId = null;
}

// --- INICIALIZAÇÃO E EVENTOS ---

btnModalCancelar.addEventListener('click', fecharModalConfirmacao);

btnModalConfirmar.addEventListener('click', () => {
  if (agendamentoParaCancelarId && currentUid) {
    cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
  } else {
    Toastify({ text: "Erro: Nenhum agendamento selecionado.", duration: 3000, backgroundColor: "#FF6347" }).showToast();
    fecharModalConfirmacao();
  }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        const uid = user.uid;

        if (!inputData.value) {
            inputData.value = new Date().toISOString().split("T")[0];
        }
        
        carregarAgendamentos(uid);
        inputData.addEventListener("change", () => carregarAgendamentos(uid));

    } else {
        console.log("Nenhum usuário logado. Redirecionando para login...");
        window.location.href = 'login.html';
    }
});
