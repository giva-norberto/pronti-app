/**
 * agenda.js - Versão Final Completa
 * Contém toda a lógica para carregar, exibir e cancelar agendamentos.
 * Estruturado para múltiplos usuários com segurança.
 */

import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaAgendamentos = document.getElementById("lista-agendamentos");
const inputData = document.getElementById("data-agenda");
const modalConfirmacao = document.getElementById('modal-confirmacao');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const modalMensagem = document.getElementById('modal-mensagem');

let agendamentoParaCancelarId = null;
let currentUid = null;

function formatarHorario(dataIso) {
  if (!dataIso) return "Horário inválido";
  const data = new Date(dataIso);
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function carregarAgendamentos(uid) {
  currentUid = uid;
  listaAgendamentos.innerHTML = "<p>Carregando...</p>";
  const dataSelecionada = inputData.value;
  if (!dataSelecionada) {
    listaAgendamentos.innerHTML = "<p>Selecione uma data.</p>";
    return;
  }

  try {
    const colecao = collection(db, `users/${uid}/agendamentos`);
    const snapshot = await getDocs(colecao);
    const agendamentos = [];

    for (const docAg of snapshot.docs) {
      const ag = docAg.data();
      if (!ag.horario) continue;
      const dataAgFormatada = new Date(ag.horario).toISOString().split("T")[0];

      if (dataAgFormatada === dataSelecionada && ag.status !== 'cancelado') {
        ag.id = docAg.id;
        if (ag.servicoId) {
          const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
          ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço Avulso";
        } else {
          ag.servicoNome = "Serviço Avulso";
        }
        agendamentos.push(ag);
      }
    }
    renderizarAgendamentos(agendamentos);
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    listaAgendamentos.innerHTML = `<p style="color:red;">Ocorreu um erro ao buscar os dados.</p>`;
  }
}

function renderizarAgendamentos(agendamentos) {
  if (agendamentos.length === 0) {
    listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado.</p>`;
    return;
  }
  
  listaAgendamentos.innerHTML = "";
  agendamentos.sort((a, b) => new Date(a.horario) - new Date(b.horario));

  agendamentos.forEach(ag => {
    const div = document.createElement("div");
    div.className = "agendamento-item";
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
      if (modalMensagem) modalMensagem.textContent = "Você tem certeza que deseja cancelar este agendamento?";
      if (modalConfirmacao) modalConfirmacao.style.display = 'flex';
    });
  });
}

async function cancelarAgendamentoFirebase(agendamentoId, uid) {
  try {
    const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
    await updateDoc(agendamentoRef, { status: 'cancelado' });
    Toastify({ text: "Agendamento cancelado!", duration: 3000, backgroundColor: "#4CAF50", gravity: "top", position: "right" }).showToast();
    carregarAgendamentos(uid);
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    Toastify({ text: "Erro ao cancelar.", duration: 3000, backgroundColor: "#FF6347", gravity: "top", position: "right" }).showToast();
  } finally {
    fecharModalConfirmacao();
  }
}

function fecharModalConfirmacao() {
  if (modalConfirmacao) modalConfirmacao.style.display = 'none';
  agendamentoParaCancelarId = null;
}

if (btnModalCancelar && btnModalConfirmar) {
  btnModalCancelar.addEventListener('click', fecharModalConfirmacao);
  btnModalConfirmar.addEventListener('click', () => {
    if (agendamentoParaCancelarId && currentUid) {
      cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (!inputData.value) {
      const hoje = new Date();
      // Ajusta para o fuso horário local para evitar problemas com data
      hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
      inputData.value = hoje.toISOString().split("T")[0];
    }
    carregarAgendamentos(user.uid);
    // Garante que o listener seja adicionado apenas uma vez
    const inputClone = inputData.cloneNode(true);
    inputData.parentNode.replaceChild(inputClone, inputData);
    inputClone.addEventListener("change", () => carregarAgendamentos(user.uid));
  } else {
    // Redireciona para o login se não houver usuário
    window.location.href = 'login.html';
  }
});
