import { getFirestore, collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const clientesCollection = collection(db, "clientes");
const form = document.getElementById('form-cliente');
const nomeInput = document.getElementById('nome-cliente');
const btnSalvar = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nome = nomeInput.value;
  if (!nome.trim()) {
    Toastify({ text: "O campo 'Nome Completo' é obrigatório.", style: { background: "#ffc107", color: "#333" } }).showToast();
    return;
  }
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Salvando...';
  const novoCliente = {
    nome: nome,
    telefone: document.getElementById('telefone-cliente').value,
    email: document.getElementById('email-cliente').value,
    criadoEm: Timestamp.now()
  };
  try {
    await addDoc(clientesCollection, novoCliente);
    Toastify({ text: `Cliente "${nome}" salvo com sucesso!`, style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } }).showToast();
    form.reset();
    setTimeout(() => { window.location.href = 'clientes.html'; }, 2000);
  } catch (error) {
    console.error("Erro ao salvar cliente: ", error);
    Toastify({ text: "Erro ao salvar o cliente.", style: { background: "#dc3545" } }).showToast();
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Cliente';
  }
});