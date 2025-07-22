/**
 * novo-servico.js (Painel do Dono - Corrigido para Multi-Usuário)
 * * Este script foi atualizado para salvar o novo serviço dentro da "pasta"
 * do usuário que está logado, garantindo que ele apareça na listagem.
 */

import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-servico');

// A verificação de login é o "porteiro" da página.
// O formulário só funcionará se o usuário estiver autenticado.
onAuthStateChanged(auth, (user) => {
  if (user) {
    // O usuário está logado, podemos habilitar o formulário.
    // Passamos o ID do usuário (uid) para a função que lida com o salvamento.
    form.addEventListener('submit', (event) => handleFormSubmit(event, user.uid));
  } else {
    // Se não há usuário, redireciona para a página de login para evitar erros.
    console.log("Nenhum usuário logado. Redirecionando para login.html...");
    window.location.href = 'login.html';
  }
});

/**
 * Lida com o envio do formulário, usando o uid do usuário para salvar o dado no local correto.
 * @param {Event} event - O evento de submit do formulário.
 * @param {string} uid - O ID do usuário logado.
 */
async function handleFormSubmit(event, uid) {
  event.preventDefault();

  // Pega os valores dos campos do formulário
  const nome = form.nome.value.trim();
  const descricao = form.descricao.value.trim();
  const duracao = parseInt(form.duracao.value) || 0;
  const preco = parseFloat(form.preco.value.replace(',', '.')) || 0;

  // Validação simples para garantir que os campos essenciais foram preenchidos
  if (!nome || preco <= 0 || duracao <= 0) {
    alert('Por favor, preencha todos os campos corretamente.');
    return;
  }

  const novoServico = {
    nome: nome,
    descricao: descricao,
    duracao: duracao,
    preco: preco,
    ownerId: uid, // Guarda o ID do dono para referência futura
    criadoEm: new Date() // Guarda a data de criação
  };

  try {
    // AQUI ESTÁ A CORREÇÃO PRINCIPAL:
    // A gravação é feita na coleção segura do usuário logado.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    
    await addDoc(servicosUserCollection, novoServico);
    
    alert("Serviço salvo com sucesso!");
    window.location.href = 'servicos.html'; // Volta para a lista de serviços

  } catch (error) {
    console.error("Erro ao salvar serviço: ", error);
    alert("Ocorreu um erro ao salvar o serviço. Tente novamente.");
  }
}

