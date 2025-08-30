/**
 * clientes.js
 * Gerencia a exibição e manipulação de clientes para o empresário logado.
 * Utiliza a estrutura de subcoleção: 'empresarios/{empresaId}/clientes'.
 * Firebase Modular v10+
 */

// Importa instâncias já inicializadas (NÃO precisa importar firebaseConfig!)
import { db, auth } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Elementos do DOM ---
const listaClientesDiv = document.getElementById("lista-clientes");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

let empresaId = null; // Armazena o ID da empresa ativa

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Exibe uma notificação toast na tela. Usa Toastify se disponível, senão um alert.
 * @param {string} texto - A mensagem a ser exibida.
 * @param {string} cor - A cor de fundo do toast (ex: '#28a745' para sucesso).
 */
function mostrarToast(texto, cor = '#38bdf8') {
  if (typeof Toastify !== "undefined") {
    Toastify({
      text: texto,
      duration: 4000,
      gravity: "top",
      position: "right",
      style: { background: cor, color: "white" }
    }).showToast();
  } else {
    alert(texto);
  }
}

/**
 * Exibe um modal de confirmação e retorna uma Promise que resolve como true (confirmado) ou false (cancelado).
 * @param {string} mensagem - A pergunta de confirmação a ser exibida.
 * @returns {Promise<boolean>}
 */
function mostrarConfirmacao(mensagem) {
  if (!modal || !modalMensagem || !btnModalConfirmar || !btnModalCancelar) {
      // Se o modal não existe no HTML, usa o confirm padrão do navegador
      return Promise.resolve(window.confirm(mensagem));
  }

  modalMensagem.textContent = mensagem;
  modal.classList.add("show");

  return new Promise((resolve) => {
    const fecharModal = (resultado) => {
      modal.classList.remove("show");
      // Remove os listeners para não acumularem
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

// --- LÓGICA PRINCIPAL DA PÁGINA ---

/**
 * Ponto de entrada: verifica a autenticação do usuário e inicia a página.
 */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    empresaId = localStorage.getItem("empresaAtivaId");
    if (empresaId) {
      inicializarPaginaClientes();
    } else {
      exibirMensagemDeErro("Selecione uma empresa para visualizar os clientes.");
      // window.location.href = "selecionar-empresa.html";
    }
  } else {
    window.location.href = "login.html";
  }
});

/**
 * Configura os listeners de eventos e carrega os dados iniciais.
 */
function inicializarPaginaClientes() {
  configurarListenersDeAcao();
  carregarClientes();
}

/**
 * Carrega os clientes do Firestore e os renderiza na tela.
 */
async function carregarClientes() {
  if (!listaClientesDiv) return;
  listaClientesDiv.innerHTML = "<p>Carregando clientes...</p>";

  try {
    const clientesRef = collection(db, "empresarios", empresaId, "clientes");
    const q = query(clientesRef, orderBy("nome"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaClientesDiv.innerHTML = '<p>Você ainda não cadastrou nenhum cliente.</p>';
      return;
    }

    listaClientesDiv.innerHTML = ''; // Limpa a lista antes de adicionar os novos cards
    snapshot.forEach(docItem => {
      const cliente = docItem.data();
      const clienteId = docItem.id;

      // Cria o elemento do card usando a estrutura HTML PADRONIZADA
      const cardElement = document.createElement('div');
      cardElement.className = 'card';
      cardElement.setAttribute('data-id', clienteId);
      
      cardElement.innerHTML = `
        <div class="card-title">${cliente.nome}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-phone"></i> ${cliente.telefone || "Não informado"}</p>
          <p><i class="fa-solid fa-envelope"></i> ${cliente.email || "Não informado"}</p>
        </div>
        <div class="card-actions">
          <a href="novo-cliente.html?id=${clienteId}" class="btn btn-edit" data-id="${clienteId}"><i class="fa-solid fa-pen"></i> Editar</a>
          <button class="btn btn-remove" data-id="${clienteId}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      `;
      listaClientesDiv.appendChild(cardElement);
    });
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    exibirMensagemDeErro("Ocorreu um erro ao carregar a lista de clientes.");
  }
}

/**
 * Exclui um cliente do Firestore e remove seu card da tela.
 * @param {string} id - O ID do cliente a ser excluído.
 */
async function excluirCliente(id) {
  try {
    await deleteDoc(doc(db, "empresarios", empresaId, "clientes", id));
    
    const itemRemovido = document.querySelector(`.card[data-id="${id}"]`);
    if (itemRemovido) {
      itemRemovido.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      itemRemovido.style.opacity = "0";
      itemRemovido.style.transform = "scale(0.95)";
      setTimeout(() => itemRemovido.remove(), 400);
    }
    
    mostrarToast("Cliente excluído com sucesso!", "#ef4444"); // Vermelho para exclusão
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);
    mostrarToast("Erro ao excluir o cliente.", "#ef4444");
  }
}

/**
 * Configura um único listener de eventos na lista de clientes para lidar com cliques de ação.
 */
function configurarListenersDeAcao() {
  if (!listaClientesDiv) return;
  
  listaClientesDiv.addEventListener("click", async (event) => {
    const target = event.target;
    
    // Procura pelo botão de remover mais próximo
    const btnRemove = target.closest(".btn-remove");
    if (btnRemove) {
      const clienteId = btnRemove.dataset.id;
      const card = btnRemove.closest(".card");
      const nomeCliente = card ? card.querySelector(".card-title").textContent : "este cliente";

      const confirmado = await mostrarConfirmacao(`Tem certeza que deseja excluir "${nomeCliente}"? Esta ação não pode ser desfeita.`);

      if (confirmado && clienteId) {
        await excluirCliente(clienteId);
      }
    }
  });
}

/**
 * Exibe uma mensagem de erro central na área de conteúdo.
 * @param {string} mensagem 
 */
function exibirMensagemDeErro(mensagem) {
    if (listaClientesDiv) {
        listaClientesDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
    }
}
