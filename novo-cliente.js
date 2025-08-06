/**
 * novo-cliente.js (Painel do Dono - Atualizado para Firebase v10+)
 *
 * - Totalmente compatível com Firestore Modular v10 ou superior.
 * - Salva clientes em 'empresarios/{empresaId}/clientes'.
 * - Usa imports via npm (não CDN).
 */

import { getFirestore, collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "./firebase-config.js";

// Inicialização do Firestore e Auth
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
    Toastify({
        text: "O campo 'Nome Completo' é obrigatório.",
        duration: 3000,
        gravity: "top",
        position: "right",
        style: { background: "var(--cor-aviso)", color: "white" }
    }).showToast();
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
      Toastify({
          text: `Um cliente com o nome "${nome}" já existe.`,
          duration: 4000,
          gravity: "top",
          position: "right",
          style: { background: "var(--cor-aviso)", color: "white" }
      }).showToast();
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

    Toastify({
      text: `Cliente "${nome}" salvo com sucesso!`,
      duration: 3000,
      gravity: "top",
      position: "right",
      style: { background: "var(--cor-sucesso)" }
    }).showToast();

    form.reset();
    setTimeout(() => { window.location.href = 'clientes.html'; }, 2000);

  } catch (error) {
    console.error("Erro ao salvar cliente: ", error);
    Toastify({
      text: `Erro ao salvar o cliente: ${error.message}`,
      duration: 4000,
      gravity: "top",
      position: "right",
      style: { background: "var(--cor-perigo)" }
    }).showToast();

  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Cliente';
  }
}
