/**
 * clientes.js (Painel do Dono - Firebase v10+ via CDN)
 * Atualizado para Firestore Modular v10+ e uso direto em navegador.
 * - Busca e exibe clientes em 'empresarios/{empresaId}/clientes'.
 * - Permite excluir cliente dessa subcoleção.
 * - Usa Toastify se disponível, senão usa alert.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js"; // Seu firebase-config.js deve exportar firebaseConfig

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const listaClientesDiv = document.getElementById('lista-clientes');
const modal = document.getElementById('modal-confirmacao');
const modalMensagem = document.getElementById('modal-mensagem');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');

let empresaId = null; // Variável global para guardar o ID da empresa

// Validação de login e obtenção da empresa
onAuthStateChanged(auth, async (user) => {
  if (user) {
    empresaId = await getEmpresaIdDoDono(user.uid);
    if (empresaId) {
        inicializarPaginaClientes();
    } else {
        listaClientesDiv.innerHTML = "<p style='color:red;'>Não foi possível encontrar uma empresa associada a este utilizador.</p>";
    }
  } else {
    window.location.href = 'login.html';
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
      modalMensagem.textContent = mensagem;
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('visivel'), 10);

      return new Promise((resolve) => {
        btnModalConfirmar.onclick = () => {
          modal.classList.remove('visivel');
          setTimeout(() => modal.style.display = 'none', 300);
          resolve(true);
        };
        btnModalCancelar.onclick = () => {
          modal.classList.remove('visivel');
          setTimeout(() => modal.style.display = 'none', 300);
          resolve(false);
        };
      });
    }

    async function carregarClientesDoFirebase() {
        listaClientesDiv.innerHTML = "<p>A carregar clientes...</p>";
        try {
            // Subcoleção correta da empresa
            const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
            const clientesQuery = query(clientesCollection, orderBy("nome"));
            const clientesSnapshot = await getDocs(clientesQuery);

            if (clientesSnapshot.empty) {
                listaClientesDiv.innerHTML = '<p>Nenhum cliente cadastrado.</p>'; return;
            }
            listaClientesDiv.innerHTML = '';
            clientesSnapshot.forEach(docItem => {
                const cliente = docItem.data(); const clienteId = docItem.id;
                if (cliente.nome) { 
                    const el = document.createElement('div');
                    el.classList.add('cliente-item'); el.dataset.id = clienteId;
                    el.innerHTML = `
                        <div class="item-info"><h3>${cliente.nome}</h3><p style="color: #6b7280; margin: 5px 0 0 0;">${cliente.telefone || ''}</p></div>
                        <div class="item-acoes"><a href="ficha-cliente.html?id=${clienteId}" class="btn-ver-historico">Ver histórico</a><button class="btn-excluir" data-id="${clienteId}">Excluir</button></div>
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
            if (itemRemovido) itemRemovido.remove();
        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            mostrarToast("Erro ao excluir o cliente.", "var(--cor-perigo)");
        }
    }

    listaClientesDiv.addEventListener('click', async (event) => {
        if (event.target && event.target.classList.contains('btn-excluir')) {
            const clienteId = event.target.dataset.id;
            const nomeCliente = event.target.closest('.cliente-item').querySelector('h3').textContent;
            const confirmado = await mostrarConfirmacao(`Tem a certeza de que deseja excluir "${nomeCliente}"? Esta ação é permanente.`);
            if (confirmado) {
                excluirCliente(clienteId);
            }
        }
    });

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
