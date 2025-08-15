/**
 * clientes.js (Painel do Dono - Corrigido para a estrutura 'empresarios')
 * Firebase Modular v10+ via CDN
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

// Elementos DOM
const listaClientesDiv = document.getElementById("lista-clientes");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

let empresaId = null; // Variável global para guardar o ID da empresa

// Função para mostrar Toast (usando Toastify ou fallback simples)
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

// Função para mostrar confirmação no modal
function mostrarConfirmacao(mensagem) {
  btnModalConfirmar && (btnModalConfirmar.onclick = null);
  btnModalCancelar && (btnModalCancelar.onclick = null);

  if (modalMensagem) modalMensagem.textContent = mensagem;
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("ativo");
  }

  return new Promise((resolve) => {
    const handleConfirm = () => {
      if (modal) {
        modal.classList.remove("ativo");
        modal.style.display = "none";
      }
      resolve(true);
    };

    const handleCancel = () => {
      if (modal) {
        modal.classList.remove("ativo");
        modal.style.display = "none";
      }
      resolve(false);
    };

    btnModalConfirmar && (btnModalConfirmar.onclick = handleConfirm);
    btnModalCancelar && (btnModalCancelar.onclick = handleCancel);

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        handleCancel();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);

    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };
    }
  });
}

// Listener para botão excluir
function safeAddClientesListener() {
  if (!listaClientesDiv) {
    console.error("Elemento #lista-clientes não encontrado no DOM.");
    return;
  }
  listaClientesDiv.addEventListener("click", async (event) => {
    if (event.target && event.target.classList.contains("btn-excluir")) {
      event.preventDefault();
      event.stopPropagation();

      const clienteId = event.target.dataset.id;
      const nomeCliente = event.target.closest(".card-cliente")?.querySelector(".card-cliente-nome")?.textContent
        || event.target.closest(".cliente-item")?.querySelector("h3")?.textContent
        || "";

      const confirmado = await mostrarConfirmacao(`Tem a certeza de que deseja excluir "${nomeCliente}"? Esta ação é permanente.`);

      if (confirmado) {
        await excluirCliente(clienteId);
      }
    }
  });
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

function inicializarPaginaClientes() {
  safeAddClientesListener();
  carregarClientesDoFirebase();
}

async function carregarClientesDoFirebase() {
  listaClientesDiv.innerHTML = "<p>A carregar clientes...</p>";
  try {
    const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
    const clientesQuery = query(clientesCollection, orderBy("nome"));
    const clientesSnapshot = await getDocs(clientesQuery);

    if (clientesSnapshot.empty) {
      listaClientesDiv.innerHTML = '<p>Nenhum cliente cadastrado.</p>';
      return;
    }
    listaClientesDiv.innerHTML = '';
    clientesSnapshot.forEach(docItem => {
      const cliente = docItem.data();
      const clienteId = docItem.id;
      if (cliente.nome) { 
        // CARD PADRÃO PRONTI
        const el = document.createElement('div');
        el.classList.add('card-cliente');
        el.setAttribute('data-id', clienteId);
        el.innerHTML = `
          <div class="card-cliente-nome">${cliente.nome}</div>
          <div class="card-cliente-info">
            <span><i class="fa-solid fa-phone"></i> ${cliente.telefone || ""}</span>
            <span><i class="fa-solid fa-envelope"></i> ${cliente.email || ""}</span>
          </div>
          <div class="card-cliente-acoes">
            <a href="ficha-cliente.html?id=${clienteId}" class="btn-copy"><i class="fa-regular fa-file-lines"></i> Histórico</a>
            <button class="btn-edit" data-id="${clienteId}"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn-remove btn-excluir" data-id="${clienteId}"><i class="fa-solid fa-trash"></i> Excluir</button>
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
    const itemRemovido = document.querySelector(`.card-cliente[data-id="${id}"]`);
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
