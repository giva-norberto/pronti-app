import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const servicosCollection = collection(db, "servicos");
const form = document.getElementById('form-servico');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nome = document.getElementById('nome-servico').value;
  const descricao = document.getElementById('descricao-servico').value;
  const preco = parseFloat(document.getElementById('preco-servico').value);
  const duracao = parseInt(document.getElementById('duracao-servico').value);

  const novoServico = { nome, descricao, preco, duracao };

  try {
    await addDoc(servicosCollection, novoServico);
    Toastify({
      text: "Novo serviço cadastrado!",
      duration: 3000,
      gravity: "top",
      position: "right",
      style: { background: "var(--cor-sucesso)" }
    }).showToast();
    setTimeout(() => { window.location.href = 'servicos.html'; }, 2000);
  } catch (error) {
    console.error("Erro ao salvar o serviço: ", error);
    Toastify({ text: "Falha ao cadastrar o serviço.", style: { background: "var(--cor-perigo)" } }).showToast();
  }
});