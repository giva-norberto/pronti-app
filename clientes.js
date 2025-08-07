/**
 * clientes.js (Painel do Dono - Corrigido para a estrutura 'empresarios')
 *
 * Alterações:
 * - A lógica agora primeiro descobre o 'empresaId' do dono logado.
 * - As funções de carregar e excluir clientes agora apontam para a
 * subcoleção 'empresarios/{empresaId}/clientes'.
 * clientes.js (Painel do Dono - Firebase v10+ via CDN)
 * Atualizado para Firestore Modular v10+ e uso direto em navegador.
 * - Busca e exibe clientes em 'empresarios/{empresaId}/clientes'.
 * - Permite excluir cliente dessa subcoleção.
 * - Usa Toastify se disponível, senão usa alert.
 */

import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js"; // Seu firebase-config.js deve exportar firebaseConfig

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

@@ -22,31 +24,28 @@ const btnModalCancelar = document.getElementById('btn-modal-cancelar');

let empresaId = null; // Variável global para guardar o ID da empresa

// A verificação de login é o "porteiro" da página.
// Validação de login e obtenção da empresa
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
 * @returns {Promise<string|null>} - O ID da empresa ou null se não encontrada.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(empresQ);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}
@@ -78,7 +77,7 @@ function inicializarPaginaClientes() {
    async function carregarClientesDoFirebase() {
        listaClientesDiv.innerHTML = "<p>A carregar clientes...</p>";
        try {
            // CORREÇÃO: Aponta para a subcoleção 'clientes' dentro da empresa correta.
            // Subcoleção correta da empresa
            const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
            const clientesQuery = query(clientesCollection, orderBy("nome"));
            const clientesSnapshot = await getDocs(clientesQuery);
@@ -87,8 +86,8 @@ function inicializarPaginaClientes() {
                listaClientesDiv.innerHTML = '<p>Nenhum cliente cadastrado.</p>'; return;
            }
            listaClientesDiv.innerHTML = '';
            clientesSnapshot.forEach(doc => {
                const cliente = doc.data(); const clienteId = doc.id;
            clientesSnapshot.forEach(docItem => {
                const cliente = docItem.data(); const clienteId = docItem.id;
                if (cliente.nome) { 
                    const el = document.createElement('div');
                    el.classList.add('cliente-item'); el.dataset.id = clienteId;
@@ -99,20 +98,21 @@ function inicializarPaginaClientes() {
                    listaClientesDiv.appendChild(el);
                }
            });
        } catch (error) { console.error("Erro ao buscar clientes:", error); }
        } catch (error) { 
            console.error("Erro ao buscar clientes:", error); 
            mostrarToast("Erro ao buscar clientes.", "var(--cor-perigo)");
        }
    }

    async function excluirCliente(id) {
        try {
            // CORREÇÃO: Aponta para o documento dentro da subcoleção 'clientes' da empresa correta.
            await deleteDoc(doc(db, "empresarios", empresaId, "clientes", id));
            // AVISO: A biblioteca Toastify não é padrão. Se não funcionar, substitua por alert().
            Toastify({ text: "Cliente excluído com sucesso!", style: { background: "var(--cor-perigo)" } }).showToast();
            mostrarToast("Cliente excluído com sucesso!", "var(--cor-perigo)");
            const itemRemovido = document.querySelector(`.cliente-item[data-id="${id}"]`);
            if (itemRemovido) itemRemovido.remove();
        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            Toastify({ text: "Erro ao excluir o cliente.", style: { background: "var(--cor-perigo)" } }).showToast();
            mostrarToast("Erro ao excluir o cliente.", "var(--cor-perigo)");
        }
    }

@@ -129,3 +129,22 @@ function inicializarPaginaClientes() {

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
