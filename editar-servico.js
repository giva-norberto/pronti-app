import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const form = document.getElementById('form-editar-servico');
const nomeInput = document.getElementById('nome-servico');
const descricaoInput = document.getElementById('descricao-servico');
const precoInput = document.getElementById('preco-servico');
const duracaoInput = document.getElementById('duracao-servico');

const urlParams = new URLSearchParams(window.location.search);
const servicoId = urlParams.get('id');

async function carregarDadosDoServico() {
  if (!servicoId) {
    window.location.href = 'servicos.html';
    return;
  }
  try {
    const docRef = doc(db, "servicos", servicoId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const servico = docSnap.data();
      nomeInput.value = servico.nome;
      descricaoInput.value = servico.descricao || '';
      precoInput.value = servico.preco;
      duracaoInput.value = servico.duracao;
    } else {
      window.location.href = 'servicos.html';
    }
  } catch (error) {
    console.error("Erro ao carregar serviço:", error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const dadosAtualizados = {
    nome: nomeInput.value,
    descricao: descricaoInput.value,
    preco: parseFloat(precoInput.value),
    duracao: parseInt(duracaoInput.value)
  };
  try {
    const docRef = doc(db, "servicos", servicoId);
    await updateDoc(docRef, dadosAtualizados);
    Toastify({ text: "Serviço atualizado com sucesso!", style: { background: "#0d6efd" } }).showToast();
    setTimeout(() => { window.location.href = 'servicos.html'; }, 2000);
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    Toastify({ text: "Erro ao salvar as alterações.", style: { background: "red" } }).showToast();
  }
});

carregarDadosDoServico();