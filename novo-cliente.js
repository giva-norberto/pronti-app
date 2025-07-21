// IMPORTAÇÕES: Adicionamos "Timestamp", "query", "where", e "getDocs"
import { getFirestore, collection, addDoc, Timestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

// INICIALIZAÇÃO
const db = getFirestore(app);
const clientesCollection = collection(db, "clientes");

// ELEMENTOS DA PÁGINA
const form = document.getElementById('form-cliente');
const nomeInput = document.getElementById('nome-cliente');
const btnSalvar = form.querySelector('button[type="submit"]');

// LÓGICA DO FORMULÁRIO COM AS NOVAS MENSAGENS PADRONIZADAS
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nome = nomeInput.value.trim();
  const telefone = document.getElementById('telefone-cliente').value;
  const email = document.getElementById('email-cliente').value;

  // Mensagem de validação padronizada
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
  btnSalvar.textContent = 'Verificando...';

  try {
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
      return; 
    }

    btnSalvar.textContent = 'Salvando...';

    const novoCliente = {
      nome: nome,
      telefone: telefone,
      email: email,
      criadoEm: Timestamp.now()
    };

    await addDoc(clientesCollection, novoCliente);

    // Mensagem de sucesso padronizada
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
    // Mensagem de erro padronizada
    Toastify({ text: "Erro ao salvar o cliente.", style: { background: "var(--cor-perigo)" } }).showToast();

  } finally {
    // Reabilita o botão em qualquer cenário
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Cliente';
  }
});