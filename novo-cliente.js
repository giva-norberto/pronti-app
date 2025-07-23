/**
 * novo-cliente.js (Painel do Dono - Lógica do Utilizador com Multi-Utilizador)
 * * Este script foi construído sobre o código-base fornecido pelo utilizador,
 * * adicionando a camada de segurança para múltiplos utilizadores sem alterar
 * * as funções e fórmulas originais.
 */

// IMPORTAÇÕES: Adicionamos "Timestamp", "query", "where", e "getDocs"
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

// A verificação de login é o "porteiro" da página.
onAuthStateChanged(auth, (user) => {
  if (user) {
    // O utilizador está autenticado, podemos habilitar o formulário.
    const uid = user.uid;
    form.addEventListener('submit', (event) => handleFormSubmit(event, uid));
  } else {
    // Se não há utilizador autenticado, redireciona para a tela de login.
    console.log("Nenhum utilizador autenticado. A redirecionar para login.html...");
    window.location.href = 'login.html';
  }
});

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

  // Sua mensagem de validação original
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
  btnSalvar.textContent = 'A verificar...';

  try {
    // MUDANÇA: Aponta para a coleção segura do utilizador.
    const clientesUserCollection = collection(db, "users", uid, "clientes");
    const q = query(clientesUserCollection, where("nome", "==", nome));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      Toastify({ 
          text: `Um cliente com o nome "${nome}" já existe.`,
          duration: 4000,
          gravity: "top",
          position: "right",
          style: { background: "var(--cor-aviso)", color: "white" } 
      }).showToast();
      return; 
    }

    btnSalvar.textContent = 'A salvar...';

    const novoCliente = {
      nome: nome,
      telefone: telefone,
      email: email,
      criadoEm: Timestamp.now()
    };

    await addDoc(clientesUserCollection, novoCliente);

    // Sua mensagem de sucesso original
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
    // Sua mensagem de erro original
    Toastify({ text: "Erro ao salvar o cliente.", style: { background: "var(--cor-perigo)" } }).showToast();

  } finally {
    // Reabilita o botão em qualquer cenário
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Cliente';
  }
}
