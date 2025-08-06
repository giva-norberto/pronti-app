/**
 * novo-cliente.js (Painel do Dono - Firebase v10+ via CDN)
 * Atualizado para uso direto no navegador com a CDN oficial do Firebase v10+.
 * - Salva clientes em 'empresarios/{empresaId}/clientes'.
 * - Exibe mensagens Toastify se disponível, senão usa alert.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js"; // Seu firebase-config.js deve exportar firebaseConfig

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ELEMENTOS DA PÁGINA
const form = document.getElementById('form-cliente');
const nomeInput = document.getElementById('nome-cliente');
const telefoneInput = document.getElementById('telefone-cliente');
const emailInput = document.getElementById('email-cliente');
const btnSalvar = form.querySelector('button[type="submit"]');

// Previne múltiplos listeners
let formListenerAdicionado = false;

onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    if (!formListenerAdicionado) {
      form.addEventListener('submit', (event) => handleFormSubmit(event, uid));
      formListenerAdicionado = true;
    }
  } else {
    window.location.href = 'login.html';
  }
});

/**
 * Busca o ID da empresa do dono logado.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
async function getEmpresaIdDoDono(uid) {
  const empresariosCol = collection(db, "empresarios");
  const q = query(empresariosCol, where("donoId", "==", uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.error("Nenhuma empresa encontrada para o dono com UID:", uid);
    return null;
  }
  return snapshot.docs[0].id;
}

/**
 * Salva um novo cliente na subcoleção correta.
 * @param {Event} event
 * @param {string} uid
 */
async function handleFormSubmit(event, uid) {
  event.preventDefault();

  const nome = nomeInput.value.trim();
  const telefone = telefoneInput.value.trim();
  const email = emailInput.value.trim();

  if (!nome) {
    mostrarToast("O campo 'Nome Completo' é obrigatório.", "var(--cor-aviso)");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A salvar...';

  try {
    // 1. Busca o ID da empresa do dono logado.
    const empresaId = await getEmpresaIdDoDono(uid);
    if (!empresaId) {
      throw new Error("Não foi possível encontrar a empresa associada. Verifique seu perfil.");
    }

    // 2. Subcoleção correta: 'empresarios/{empresaId}/clientes'
    const clientesCollection = collection(db, "empresarios", empresaId, "clientes");

    // 3. Verifica duplicidade por nome
    const q = query(clientesCollection, where("nome", "==", nome));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      mostrarToast(`Um cliente com o nome "${nome}" já existe.`, "var(--cor-aviso)");
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Cliente';
      return;
    }

    const novoCliente = {
      nome,
      telefone,
      email,
      criadoEm: Timestamp.now()
    };

    await addDoc(clientesCollection, novoCliente);

    mostrarToast(`Cliente "${nome}" salvo com sucesso!`, "var(--cor-sucesso)");

    form.reset();
    setTimeout(() => { window.location.href = 'clientes.html'; }, 2000);

  } catch (error) {
    console.error("Erro ao salvar cliente: ", error);
    mostrarToast(`Erro ao salvar o cliente: ${error.message}`, "var(--cor-perigo)");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Cliente';
  }
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
