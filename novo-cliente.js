/**
 * novo-cliente.js (Cadastro de Novo Cliente - Firebase v10+ via CDN)
 * Atualizado para Firestore Modular v10+ e uso direto em navegador.
 * - Cadastra novo cliente em 'empresarios/{empresaId}/clientes'.
 * - Usa Toastify se disponível, senão usa alert.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js"; // Seu firebase-config.js deve exportar firebaseConfig

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos do formulário
const formNovoCliente = document.getElementById('form-novo-cliente');
const inputNome = document.getElementById('nome-cliente');
const inputTelefone = document.getElementById('telefone-cliente');
const btnSalvar = document.getElementById('btn-salvar-cliente');

let empresaId = null; // Variável global para guardar o ID da empresa

// Proteção: só adiciona listener se todos os elementos existem
function inicializarPaginaNovoCliente() {
  if (!formNovoCliente || !inputNome || !btnSalvar) return;

  formNovoCliente.addEventListener('submit', async (event) => {
    event.preventDefault();
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
      const nome = inputNome.value.trim();
      const telefone = inputTelefone ? inputTelefone.value.trim() : "";

      if (!nome) {
        mostrarToast("O nome do cliente é obrigatório.", "var(--cor-perigo)");
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Cliente";
        return;
      }

      // Adiciona o cliente ao Firestore
      const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
      await addDoc(clientesCollection, {
        nome,
        telefone,
        criadoEm: new Date()
      });

      mostrarToast("Cliente cadastrado com sucesso!", "var(--cor-sucesso)");
      formNovoCliente.reset();
    } catch (error) {
      console.error("Erro ao cadastrar cliente:", error);
      mostrarToast("Erro ao cadastrar cliente.", "var(--cor-perigo)");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Cliente";
    }
  });
}

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

// Garante que só inicializa quando autenticado e elementos existem
onAuthStateChanged(auth, async (user) => {
  if (user) {
    empresaId = await getEmpresaIdDoDono(user.uid);
    if (empresaId) {
      inicializarPaginaNovoCliente();
    } else if (formNovoCliente) {
      formNovoCliente.innerHTML = "<p style='color:red;'>Não foi possível encontrar uma empresa associada a este utilizador.</p>";
    }
  } else {
    window.location.href = 'login.html';
  }
});
