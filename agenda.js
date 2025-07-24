/**
 * agenda.js (Painel do Dono - Lógica Original com Multi-Usuário)
 * * Este script foi construído sobre o código-base fornecido pelo usuário,
 * * adicionando a camada de segurança para múltiplos usuários sem alterar
 * * as funções e fórmulas originais de carregamento de agendamentos.
 */

import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
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

// --- SUAS FUNÇÕES ORIGINAIS (INTACTAS) ---

function formatarHorario(dataIso) {
  const data = new Date(dataIso);
  return `${data.toLocaleDateString()} ${data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
    // A coleção agora aponta para a pasta segura do usuário logado.
    const colecao = collection(db, `users/${uid}/agendamentos`);
    const snapshot = await getDocs(colecao);

    const agendamentos = [];

    // A sua lógica de busca de serviços e agendamentos foi mantida.
    for (const docAg of snapshot.docs) {
      const ag = docAg.data();
      const dataAg = new Date(ag.horario);
      const dataAgFormatada = dataAg.toISOString().split("T")[0]; // "2025-07-23"

      // Filtra agendamentos apenas para a data selecionada e que não estejam cancelados
      if (dataAgFormatada === dataSelecionada && ag.status !== 'cancelado') {
        ag.id = docAg.id;

        // Busca nome do serviço via ID, dentro da pasta do usuário.
        const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
        ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço não encontrado";

        agendamentos.push(ag);
      }
    }

    if (agendamentos.length === 0) {
      const dataFormatada = new Date(dataSelecionada + 'T12:00:00').toLocaleDateString();
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado para o dia ${dataFormatada}.</p>`;
    } else {
      listaAgendamentos.innerHTML = "";

      // Ordena os agendamentos por horário antes de exibir.
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

      // Adiciona event listeners para os botões de cancelar após eles serem renderizados
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

// --- NOVAS FUNÇÕES PARA CANCELAMENTO ---

// Função para cancelar o agendamento no Firebase (Nova função)
async function cancelarAgendamentoFirebase(agendamentoId, uid) {
  if (!uid) {
    Toastify({
        text: "Erro: UID do usuário não disponível para cancelar o agendamento.",
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "#FF6347",
    }).showToast();
    return;
  }

  try {
    const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
    // Opção 1: Atualizar o status para 'cancelado' (Recomendado para histórico)
    await updateDoc(agendamentoRef, { status: 'cancelado' });

    // Opção 2: Deletar o documento (Se preferir remover totalmente, descomente abaixo e comente a linha acima)
    // await deleteDoc(agendamentoRef);

    Toastify({
        text: "Agendamento cancelado com sucesso!",
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "#4CAF50",
    }).showToast();
    carregarAgendamentos(uid); // Recarrega a lista para refletir a mudança
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    Toastify({
        text: "Erro ao cancelar agendamento.",
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "#FF6347",
    }).showToast();
  } finally {
    fecharModalConfirmacao();
  }
}

// Funções para controlar o modal
function fecharModalConfirmacao() {
  modalConfirmacao.style.display = 'none';
  agendamentoParaCancelarId = null; // Limpa o ID do agendamento
}

// Event Listeners para o modal
btnModalCancelar.addEventListener('click', fecharModalConfirmacao);
btnModalConfirmar.addEventListener('click', () => {
  if (agendamentoParaCancelarId && currentUid) {
    cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
  } else {
    Toastify({
        text: "Erro: Nenhum agendamento selecionado para cancelar ou UID indisponível.",
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "#FF6347",
    }).showToast();
    fecharModalConfirmacao();
  }
});

// --- NOVA ESTRUTURA DE INICIALIZAÇÃO ---
// Garante que o código só rode após a confirmação do login.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado.
        const uid = user.uid;

        // Define a data atual como padrão no input.
        if (!inputData.value) {
            inputData.value = new Date().toISOString().split("T")[0];
        }
        
        // Carrega os agendamentos para a data padrão.
        carregarAgendamentos(uid);

        // Adiciona o listener para carregar novamente quando a data mudar.
        inputData.addEventListener("change", () => carregarAgendamentos(uid));

    } else {
        // Usuário não está logado.
        console.log("Nenhum usuário logado. Redirecionando para login...");
        window.location.href = 'login.html';
    }
});

// REMOVIDO: Este listener já é adicionado dentro de onAuthStateChanged para garantir o UID
// inputData.addEventListener("change", carregarAgendamentos);

// REMOVIDO: Este window.addEventListener("load") foi incorporado dentro de onAuthStateChanged
// para garantir que o UID esteja disponível antes de carregar os agendamentos.
/*
window.addEventListener("load", () => {
  inputData.value = new Date().toISOString().split("T")[0];
  setTimeout(carregarAgendamentos, 500); // aguarda autenticação assíncrona
});
*/
