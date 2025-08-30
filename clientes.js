/**
 * clientes.js
 * Gerencia a exibição e manipulação da lista de clientes para o empresário logado.
 * Este script opera sobre a subcoleção 'empresarios/{empresaId}/clientes'.
 * Versão do Firebase SDK: Modular v10+
 */

// Importa as instâncias e funções necessárias do Firebase SDK.
import { db, auth } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Referências aos Elementos do DOM ---
const listaClientesDiv = document.getElementById("lista-clientes");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

// Variável para armazenar o ID da empresa do usuário logado.
let empresaId = null;

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Exibe uma notificação toast na tela.
 * @param {string} texto - A mensagem a ser exibida.
 * @param {string} cor - A cor de fundo do toast.
 */
function mostrarToast(texto, cor = '#38bdf8') {
  if (typeof Toastify !== "undefined") {
    Toastify({
      text: texto,
      duration: 4000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      style: { background: cor, color: "white", borderRadius: "8px", fontWeight: "500" }
    }).showToast();
  } else {
    alert(texto);
  }
}

/**
 * Exibe um modal de confirmação e retorna uma Promise que resolve para 'true' (confirmado) ou 'false' (cancelado).
 * @param {string} mensagem - A pergunta de confirmação.
 * @returns {Promise<boolean>}
 */
function mostrarConfirmacao(mensagem) {
  if (!modal || !modalMensagem || !btnModalConfirmar || !btnModalCancelar) {
    return Promise.resolve(window.confirm(mensagem));
  }

  modalMensagem.textContent = mensagem;
  modal.classList.add("show");

  return new Promise((resolve) => {
    const fecharModal = (resultado) => {
      modal.classList.remove("show");
      btnModalConfirmar.onclick = null;
      btnModalCancelar.onclick = null;
      document.removeEventListener("keydown", handleEsc);
      resolve(resultado);
    };

    const handleConfirm = () => fecharModal(true);
    const handleCancel = () => fecharModal(false);
    
    const handleEsc = (e) => {
      if (e.key === "Escape") handleCancel();
    };

    btnModalConfirmar.onclick = handleConfirm;
    btnModalCancelar.onclick = handleCancel;
    document.addEventListener("keydown", handleEsc);
  });
}

/**
 * Exibe uma mensagem de erro na área de conteúdo principal.
 * @param {string} mensagem A mensagem de erro a ser exibida.
 */
function exibirMensagemDeErro(mensagem) {
    if (listaClientesDiv) {
        listaClientesDiv.innerHTML = `<p class="mensagem-erro">${mensagem}</p>`;
    }
}

// --- LÓGICA PRINCIPAL DA PÁGINA ---

/**
 * Ponto de entrada: verifica a autenticação do usuário e inicia a página.
 */
onAuthStateChanged(auth, (user) => {
  if (user) {
    empresaId = localStorage.getItem("empresaAtivaId");
    if (empresaId) {
      inicializarPaginaClientes();
    } else {
      exibirMensagemDeErro("Nenhuma empresa selecionada. Por favor, selecione uma empresa para ver os clientes.");
    }
  } else {
    window.location.href = "login.html";
  }
});

/**
 * Configura os listeners e carrega os dados iniciais.
 */
function inicializarPaginaClientes() {
  configurarListenersDeAcao();
  carregarClientes();
}

/**
 * Carrega a lista de clientes do Firestore e a renderiza na tela.
 */
async function carregarClientes() {
  // ===================== CORREÇÃO DEFINITIVA ADICIONADA AQUI =====================
  // Cláusula de guarda: Garante que o ID da empresa existe antes de qualquer outra ação.
  // Isso previne o erro "Expected first argument to collection()".
  if (!empresaId) {
    console.error("ID da empresa não definido. Abortando o carregamento de clientes.");
    exibirMensagemDeErro("Não foi possível carregar os clientes. ID da empresa não foi encontrado.");
    return; // Interrompe a execução da função imediatamente.
  }
  // ===============================================================================

  if (!listaClientesDiv) return;

  listaClientesDiv.innerHTML = `<p class="mensagem-info">Carregando clientes...</p>`;

  try {
    // Agora, esta linha só será executada se 'empresaId' for uma string válida.
    const clientesRef = collection(db, "empresarios", empresaId, "clientes");
    
    const q = query(clientesRef, orderBy("nome"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaClientesDiv.innerHTML = '<p class="mensagem-info">Você ainda não cadastrou nenhum cliente.</p>';
      return;
    }

    listaClientesDiv.innerHTML = ''; 
    snapshot.forEach(docItem => {
      const cliente = docItem.data();
      const clienteId = docItem.id;

      const cardElement = document.createElement('div');
      cardElement.className = 'card';
      cardElement.setAttribute('data-id', clienteId);
      
      cardElement.innerHTML = `
        <div class="card-title">${cliente.nome || "Nome não informado"}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-phone"></i> ${cliente.telefone || "Não informado"}</p>
          <p><i class="fa-solid fa-envelope"></i> ${cliente.email || "Não informado"}</p>
        </div>
        <div class="card-actions">
          <a href="novo-cliente.html?id=${clienteId}" class="btn btn-edit" title="Editar ${cliente.nome}"><i class="fa-solid fa-pen"></i> Editar</a>
          <button class="btn btn-remove" data-id="${clienteId}" title="Excluir ${cliente.nome}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      `;
      listaClientesDiv.appendChild(cardElement);
    });

  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    exibirMensagemDeErro("Ocorreu um erro inesperado ao carregar a lista de clientes. Tente novamente mais tarde.");
  }
}

/**
 * Exclui um cliente do Firestore após a confirmação do usuário.
 * @param {string} id - O ID do documento do cliente a ser excluído.
 */
async function excluirCliente(id) {
  try {
    const clienteDocRef = doc(db, "empresarios", empresaId, "clientes", id);
    await deleteDoc(clienteDocRef);
    
    const itemRemovido = document.querySelector(`.card[data-id="${id}"]`);
    if (itemRemovido) {
      itemRemovido.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      itemRemovido.style.opacity = "0";
      itemRemovido.style.transform = "scale(0.95)";
      setTimeout(() => itemRemovido.remove(), 400);
    }
    
    mostrarToast("Cliente excluído com sucesso!", "#ef4444");
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);
    mostrarToast("Erro ao excluir o cliente. Tente novamente.", "#ef4444");
  }
}

/**
 * Configura um único listener de eventos no container da lista de clientes (Event Delegation).
 */
function configurarListenersDeAcao() {
  if (!listaClientesDiv) return;
  
  listaClientesDiv.addEventListener("click", async (event) => {
    const target = event.target;
    
    const btnRemove = target.closest(".btn-remove");
    if (btnRemove) {
      const clienteId = btnRemove.dataset.id;
      const card = btnRemove.closest(".card");
      const nomeCliente = card ? card.querySelector(".card-title").textContent.trim() : "este cliente";

      const confirmado = await mostrarConfirmacao(`Tem certeza que deseja excluir "${nomeCliente}"? Esta ação não pode ser desfeita.`);

      if (confirmado && clienteId) {
        await excluirCliente(clienteId);
      }
    }
  });
}
