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
      text: "Serviço salvo com sucesso!",
      duration: 3000,
      gravity: "top",
      position: "right",
      style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
    }).showToast();

    // Espera 2 segundos antes de redirecionar para o usuário ver a mensagem
    setTimeout(() => { window.location.href = 'servicos.html'; }, 2000);

  } catch (error) {
    console.error("Erro ao salvar o serviço: ", error);
    Toastify({ 
        text: "Erro ao salvar o serviço.", 
        duration: 3000, 
        gravity: "top", 
        position: "right", 
        style: { background: "#dc3545" } 
    }).showToast();
  }
});