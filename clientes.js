/**
 * clientes.js (Painel do Dono - Firebase v10+ via CDN)
 * Busca e exibe clientes em 'empresarios/{empresaId}/clientes'.
 * Permite excluir cliente dessa subcoleção.
 * Usa Toastify se disponível, senão usa alert.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js"; // Seu firebase-config.js deve exportar firebaseConfig

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const listaClientesDiv = document.getElementById("lista-clientes");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

let empresaId = null;

// Checagem do elemento para evitar erro de addEventListener
function safeAddClientesListener() {
  if (listaClientesDiv) {
    listaClientesDiv.addEventListener("click", async (event) => {
      if (event.target && event.target.classList.contains("btn-excluir")) {
        event.preventDefault();
        event.stopPropagation();

        const clienteId = event.target.dataset.id;
        const nomeCliente = event.target.closest(".cliente-item").querySelector("h3").textContent;

        const confirmado = await mostrarConfirmacao(`Tem a certeza de que deseja excluir "${nomeCliente}"? Esta ação é permanente.`);

        if (confirmado) {
          await excluirCliente(clienteId);
        }
      }
    });
  } else {
    console.error("Elemento #lista-clientes não encontrado no DOM.");
  }
}

// Validação de login e obtenção da empresa
onAuthStateChanged(auth, async (user) => {
  if (user) {
    empresaId = await getEmpresaIdDoDono(user.uid);
    if (empresaId) {
      inicializarPaginaClientes();
    } else if (listaClientesDiv) {
      listaClientesDiv.innerHTML = "<p style='color:red;'>Não foi possível encontrar uma empresa associada a este utilizador.</p>";
    }
  } else {
    window.location.href = "login.html";
  }
});

/**
 * Função para encontrar o ID da empresa com base no ID do dono.
 * @param {string} uid - O ID do dono da empresa.
 * @returns {Promise<string|null>} - O ID da empresa ou null se não encontrada.
 */
async function getEmpresaIdDoDono(uid) {
  const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
  const snapshot = await getDocs(empresQ);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * Função que inicializa toda a lógica da página de clientes.
 */
function inicializarPaginaClientes() {

  function mostrarConfirmacao(mensagem) {
    // Limpar qualquer listener anterior
    btnModalConfirmar.onclick = null;
    btnModalCancelar.onclick = null;

    modalMensagem.textContent = mensagem;
    modal.style.display = "flex";
    modal.classList.add("ativo");

    return new Promise((resolve) => {
      const handleConfirm = () => {
        modal.classList.remove("ativo");
        modal.style.display = "none";
        resolve(true);
      };

      const handleCancel = () => {
        modal.classList.remove("ativo");
        modal.style.display = "none";
        resolve(false);
      };

      btnModalConfirmar.onclick = handleConfirm;
      btnModalCancelar.onclick = handleCancel;

      // Adicionar listener para fechar com ESC
      const handleEsc = (e) => {
        if (e.key === "Escape") {
          handleCancel();
          document.removeEventListener("keydown", handleEsc);
        }
      };
      document.addEventListener("keydown", handleEsc);

      // Fechar ao clicar fora do modal
      modal.onclick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };
    });
  }

  async function carregarClientesDoFirebase() {
    if (!listaClientesDiv) return;
    listaClientesDiv.innerHTML = "<p>A carregar clientes...</p>";
    try {
      // Subcoleção correta da empresa
      const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
      const clientesQuery = query(clientesCollection, orderBy("nome"));
      const clientesSnapshot = await getDocs(clientesQuery);

      if (clientesSnapshot.empty) {
        listaClientesDiv.innerHTML = "<p>Nenhum cliente cadastrado.</p>";
        return;
      }

      listaClientesDiv.innerHTML = "";
      clientesSnapshot.forEach(docItem => {
        const cliente = docItem.data();
        const clienteId = docItem.id;
        if (cliente.nome) {
          const el = document.createElement("div");
          el.classList.add("cliente-item");
          el.dataset.id = clienteId;
          el.innerHTML = `
            <div class="item-info">
              <h3>${cliente.nome}</h3>
              <p style="color: #6b7280; margin: 5px 0 0 0;">${cliente.telefone || ""}</p>
            </div>
            <div class="item-acoes">
              <a href="ficha-cliente.html?id=${clienteId}" class="btn-ver-historico">Ver histórico</a>
              <button class="btn-excluir" data-id="${clienteId}">Excluir</button>
            </div>
          `;
          listaClientesDiv.appendChild(el);
        }
      });
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      mostrarToast("Erro ao buscar clientes.", "var(--cor-perigo)");
    }
  }

  async function excluirCliente(id) {
    try {
      await deleteDoc(doc(db, "empresarios", empresaId, "clientes", id));
      mostrarToast("Cliente excluído com sucesso!", "var(--cor-perigo)");
      const itemRemovido = document.querySelector(`.cliente-item[data-id="${id}"]`);
      if (itemRemovido) {
        itemRemovido.style.transition = "opacity 0.3s ease";
        itemRemovido.style.opacity = "0";
        setTimeout(() => itemRemovido.remove(), 300);
      }
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      mostrarToast("Erro ao excluir o cliente.", "var(--cor-perigo)");
    }
  }

  safeAddClientesListener();
  carregarClientesDoFirebase();
}

/**
 * Função para mostrar Toast (usando Toastify ou fallback simples)
 * @param {string} texto
 * @param {string} cor
 */
function mostrarToast(texto, cor) {
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
