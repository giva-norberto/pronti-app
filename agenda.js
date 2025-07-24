/**
 * agenda.js - Versão Definitiva com Correções de Timing e Depuração
 */

import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Os elementos serão definidos dentro de DOMContentLoaded para garantir que existam
let listaAgendamentos, inputData, modalConfirmacao, btnModalCancelar, btnModalConfirmar, modalMensagem;

let agendamentoParaCancelarId = null;
let currentUid = null;

function formatarHorario(dataIso) {
  if (!dataIso) return "Horário inválido";
  const data = new Date(dataIso);
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function carregarAgendamentos(uid) {
  currentUid = uid;
  if (!listaAgendamentos) return;
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
        const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId || 'default'}`));
        ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço Avulso";
        agendamentos.push(ag);
      }
    }
    renderizarAgendamentos(agendamentos);
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
  }
}

function renderizarAgendamentos(agendamentos) {
  listaAgendamentos.innerHTML = "";
  if (agendamentos.length === 0) {
    listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado.</p>`;
    return;
  }
  
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

  // Adiciona listeners aos botões de cancelar de cada agendamento
  document.querySelectorAll('.btn-cancelar-agendamento').forEach(button => {
    button.addEventListener('click', (event) => {
      agendamentoParaCancelarId = event.target.dataset.id;
      console.log("1. Botão 'Cancelar Agendamento' clicado. ID a cancelar:", agendamentoParaCancelarId); // <- DEBUG
      if (modalMensagem) modalMensagem.textContent = "Você tem certeza que deseja cancelar este agendamento?";
      if (modalConfirmacao) {
        modalConfirmacao.style.display = 'flex';
        console.log("2. Modal de confirmação deve estar visível."); // <- DEBUG
      }
    });
  });
}

async function cancelarAgendamentoFirebase(agendamentoId, uid) {
  console.log("5. Função 'cancelarAgendamentoFirebase' chamada com ID:", agendamentoId); // <- DEBUG
  try {
    const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
    await updateDoc(agendamentoRef, { status: 'cancelado' });
    Toastify({ text: "Agendamento cancelado!", duration: 3000, backgroundColor: "#4CAF50" }).showToast();
    carregarAgendamentos(uid);
  } catch (error) {
    console.error("Erro ao cancelar no Firebase:", error);
    Toastify({ text: "Erro ao cancelar.", duration: 3000, backgroundColor: "#FF6347" }).showToast();
  } finally {
    fecharModalConfirmacao();
  }
}

function fecharModalConfirmacao() {
  if (modalConfirmacao) modalConfirmacao.style.display = 'none';
  agendamentoParaCancelarId = null;
  console.log("Modal fechado."); // <- DEBUG
}

// ✅ CORREÇÃO CRÍTICA: Espera o HTML estar 100% carregado antes de rodar o script
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM totalmente carregado. O script principal vai iniciar."); // <- DEBUG

  // Define as variáveis globais DEPOIS que o DOM carregou
  listaAgendamentos = document.getElementById("lista-agendamentos");
  inputData = document.getElementById("data-agenda");
  modalConfirmacao = document.getElementById('modal-confirmacao');
  btnModalCancelar = document.getElementById('btn-modal-cancelar');
  btnModalConfirmar = document.getElementById('btn-modal-confirmar');
  modalMensagem = document.getElementById('modal-mensagem');

  // Adiciona os listeners para os botões do modal com segurança
  if (btnModalCancelar && btnModalConfirmar) {
    console.log("Botões do modal encontrados. Adicionando listeners."); // <- DEBUG
    btnModalCancelar.addEventListener('click', fecharModalConfirmacao);
    btnModalConfirmar.addEventListener('click', () => {
      console.log("3. Botão 'Confirmar' do modal foi clicado."); // <- DEBUG
      if (agendamentoParaCancelarId && currentUid) {
        console.log("4. ID e UID confirmados. Chamando a função de cancelamento no Firebase."); // <- DEBUG
        cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
      } else {
        console.error("ERRO: 'agendamentoParaCancelarId' ou 'currentUid' estão nulos.");
      }
    });
  } else {
    console.error("ERRO CRÍTICO: Botões do modal não foram encontrados no HTML.");
  }

  // Ponto de entrada da autenticação
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (inputData && !inputData.value) {
        const hoje = new Date();
        hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
        inputData.value = hoje.toISOString().split("T")[0];
      }
      carregarAgendamentos(user.uid);
      inputData.addEventListener("change", () => carregarAgendamentos(user.uid));
    } else {
      window.location.href = 'login.html';
    }
  });
});
