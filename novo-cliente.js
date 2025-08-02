/**
 * novo-cliente.js (Painel do Dono - Corrigido para a estrutura 'empresarios')
 *
 * Alterações:
 * - Adicionada a função 'getEmpresaIdDoDono' para encontrar a empresa do usuário.
 * - A função 'handleFormSubmit' agora salva o cliente na subcoleção correta:
 * 'empresarios/{empresaId}/clientes'.
 */

import { getFirestore, collection, addDoc, Timestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

// ELEMENTOS DA PÁGINA
const form = document.getElementById('form-cliente');
const nomeInput = document.getElementById('nome-cliente');
const telefoneInput = document.getElementById('telefone-cliente');
const emailInput = document.getElementById('email-cliente');
const btnSalvar = form.querySelector('button[type="submit"]');

onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    form.addEventListener('submit', (event) => handleFormSubmit(event, uid));
  } else {
    console.log("Nenhum utilizador autenticado. A redirecionar para login.html...");
    window.location.href = 'login.html';
  }
});


/**
 * Função auxiliar para encontrar o ID da empresa com base no ID do dono.
 * @param {string} uid - O ID do dono da empresa.
 * @returns {string|null} - O ID da empresa.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.error("Nenhuma empresa encontrada para o dono com UID:", uid);
        return null;
    }
    return snapshot.docs[0].id;
}


/**
 * Lida com o envio do formulário, usando o uid do utilizador para salvar o dado no local correto.
 * @param {Event} event - O evento de submit do formulário.
 * @param {string} uid - O ID do utilizador autenticado.
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
    // --- CORREÇÃO PRINCIPAL ---
    // 1. Encontrar o ID da empresa do dono logado.
    const empresaId = await getEmpresaIdDoDono(uid);
    if (!empresaId) {
        throw new Error("Não foi possível encontrar a empresa associada. Verifique seu perfil.");
    }

    // 2. Apontar para a coleção correta: 'empresarios/{empresaId}/clientes'
    const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
    
    // A lógica de verificação de duplicados permanece, mas agora na coleção correta.
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
      // Importante: reabilitar o botão aqui também
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Cliente';
      return; 
    }
    
    const novoCliente = {
      nome: nome,
      telefone: telefone,
      email: email,
      criadoEm: Timestamp.now()
    };

    // 3. Salvar o documento na coleção correta.
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
    Toastify({ text: `Erro ao salvar o cliente: ${error.message}`, style: { background: "var(--cor-perigo)" } }).showToast();

  } finally {
    // Reabilita o botão em qualquer cenário
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Cliente';
  }
}
