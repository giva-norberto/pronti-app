/**
 * clientes.js (Painel do Dono - Corrigido para a estrutura 'empresarios')
 *
 * Alterações:
 * - A lógica agora primeiro descobre o 'empresaId' do dono logado.
 * - As funções de carregar e excluir clientes agora apontam para a
 * subcoleção 'empresarios/{empresaId}/clientes'.
 */

import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaClientesDiv = document.getElementById('lista-clientes');
const modal = document.getElementById('modal-confirmacao');
const modalMensagem = document.getElementById('modal-mensagem');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');

let empresaId = null; // Variável global para guardar o ID da empresa

// A verificação de login é o "porteiro" da página.
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // O utilizador está autenticado, podemos buscar o ID da empresa dele.
    empresaId = await getEmpresaIdDoDono(user.uid);
    if (empresaId) {
        inicializarPaginaClientes();
    } else {
        listaClientesDiv.innerHTML = "<p style='color:red;'>Não foi possível encontrar uma empresa associada a este utilizador.</p>";
    }
  } else {
    // Se não há utilizador autenticado, redireciona para a tela de login.
    console.log("Nenhum utilizador autenticado. A redirecionar para login.html...");
    window.location.href = 'login.html';
  }
});

/**
 * Função para encontrar o ID da empresa com base no ID do dono.
 * @param {string} uid - O ID do dono da empresa.
 * @returns {string|null} - O ID da empresa.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
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
            // CORREÇÃO: Aponta para a subcoleção 'clientes' dentro da empresa correta.
            const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
            const clientesQuery = query(clientesCollection, orderBy("nome"));
            const clientesSnapshot = await getDocs(clientesQuery);

            if (clientesSnapshot.empty) {
                listaClientesDiv.innerHTML = '<p>Nenhum cliente cadastrado.</p>'; return;
            }
            listaClientesDiv.innerHTML = '';
            clientesSnapshot.forEach(doc => {
                const cliente = doc.data(); const clienteId = doc.id;
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
        } catch (error) { console.error("Erro ao buscar clientes:", error); }
    }

    async function excluirCliente(id) {
        try {
            // CORREÇÃO: Aponta para o documento dentro da subcoleção 'clientes' da empresa correta.
            await deleteDoc(doc(db, "empresarios", empresaId, "clientes", id));
            // AVISO: A biblioteca Toastify não é padrão. Se não funcionar, substitua por alert().
            Toastify({ text: "Cliente excluído com sucesso!", style: { background: "var(--cor-perigo)" } }).showToast();
            const itemRemovido = document.querySelector(`.cliente-item[data-id="${id}"]`);
            if (itemRemovido) itemRemovido.remove();
        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            Toastify({ text: "Erro ao excluir o cliente.", style: { background: "var(--cor-perigo)" } }).showToast();
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
