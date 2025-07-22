/**
 * novo-servico.js (Painel do Dono - Versão Corrigida e Robusta)
 * * Este script foi revisado para garantir que o botão Salvar
 * * funcione de forma confiável em todas as situações.
 */

import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-servico');
let isListenerAttached = false; // Flag para garantir que o listener seja anexado apenas uma vez.

// Primeiro, verifica se o elemento do formulário existe no HTML.
if (!form) {
  console.error("Erro Crítico: O formulário com id 'form-servico' não foi encontrado no HTML.");
} else {
  // A verificação de login é o "porteiro" da página.
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Anexa o listener de submit apenas uma vez para evitar duplicações.
      if (!isListenerAttached) {
        form.addEventListener('submit', (event) => handleFormSubmit(event, user.uid));
        isListenerAttached = true;
        console.log("Listener do formulário de novo serviço anexado com sucesso.");
      }
    } else {
      // Se não há usuário, redireciona para a página de login.
      console.log("Nenhum usuário logado. Redirecionando para login.html...");
      window.location.href = 'login.html';
    }
  });
}

/**
 * Lida com o envio do formulário, usando o uid do usuário para salvar o dado no local correto.
 * @param {Event} event - O evento de submit do formulário.
 * @param {string} uid - O ID do usuário logado.
 */
async function handleFormSubmit(event, uid) {
  event.preventDefault(); // Impede o recarregamento da página.
  console.log("Botão Salvar clicado. Processando formulário...");

  // Pega os valores dos campos do formulário de forma segura.
  const nome = form.nome?.value.trim();
  const descricao = form.descricao?.value.trim() || ""; // Garante que a descrição não cause erro se não existir.
  const duracao = parseInt(form.duracao?.value) || 0;
  const preco = parseFloat(form.preco?.value.replace(',', '.')) || 0;

  // Validação simples para garantir que os campos essenciais foram preenchidos.
  if (!nome || preco <= 0 || duracao <= 0) {
    alert('Por favor, preencha os campos obrigatórios (Nome, Preço e Duração) corretamente.');
    return;
  }

  const novoServico = {
    nome: nome,
    descricao: descricao,
    duracao: duracao,
    preco: preco,
    ownerId: uid, // Guarda o ID do dono para referência futura.
    criadoEm: new Date() // Guarda a data de criação.
  };

  console.log("Dados do novo serviço a serem salvos:", novoServico);

  try {
    // A gravação é feita na coleção segura do usuário logado.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    
    await addDoc(servicosUserCollection, novoServico);
    
    alert("Serviço salvo com sucesso!");
    window.location.href = 'servicos.html'; // Volta para a lista de serviços.

  } catch (error) {
    console.error("Erro ao salvar serviço:", error);
    alert("Ocorreu um erro ao salvar o serviço. Tente novamente.");
  }
}
