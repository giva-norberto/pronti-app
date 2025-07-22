import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-servico');

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Se não estiver logado, redireciona para login
    window.location.href = 'login.html';
    return;
  }

  const uid = user.uid;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Pega os valores dos campos do formulário
    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value);

    // Validação básica
    if (!nome || isNaN(preco) || preco <= 0 || isNaN(duracao) || duracao <= 0) {
      Toastify({
        text: "Preencha todos os campos obrigatórios corretamente.",
        duration: 3000,
        style: { background: "red" }
      }).showToast();
      return;
    }

    try {
      await addDoc(collection(db, "users", uid, "servicos"), {
        nome,
        descricao,
        preco,
        duracao,
        criadoEm: new Date()
      });

      Toastify({
        text: "Serviço adicionado com sucesso!",
        duration: 3000,
        style: { background: "green" }
      }).showToast();

      form.reset(); // Limpa o formulário
      setTimeout(() => window.location.href = "servicos.html", 1000); // Redireciona após salvar

    } catch (error) {
      console.error("Erro ao salvar serviço:", error);
      Toastify({
        text: "Erro ao salvar serviço. Tente novamente.",
        duration: 4000,
        style: { background: "orange" }
      }).showToast();
    }
  });
});
