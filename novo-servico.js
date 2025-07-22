/**
 * novo-servico.js (Atualizado para Multi-Usuário)
 * * Este script agora salva o novo serviço dentro da "pasta"
 * do usuário que está logado.
 */

import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-servico');
const nomeInput = document.getElementById('nome');
const descricaoInput = document.getElementById('descricao');
const duracaoInput = document.getElementById('duracao');
const precoInput = document.getElementById('preco');

// A função principal agora só é chamada quando temos um usuário logado.
onAuthStateChanged(auth, (user) => {
  if (user) {
    // O usuário está logado, podemos habilitar o formulário.
    form.addEventListener('submit', (event) => handleFormSubmit(event, user.uid));
  } else {
    // Se não há usuário, redireciona para o login.
    console.log("Nenhum usuário logado. Redirecionando...");
    window.location.href = 'login.html'; // Crie esta página de login
  }
});

/**
 * Lida com o envio do formulário, usando o uid do usuário para salvar o dado.
 * @param {Event} event - O evento de submit do formulário.
 * @param {string} uid - O ID do usuário logado.
 */
async function handleFormSubmit(event, uid) {
  event.preventDefault();

  const novoServico = {
    nome: nomeInput.value,
    descricao: descricaoInput.value,
    duracao: parseInt(duracaoInput.value),
    preco: parseFloat(precoInput.value),
    // Opcional: guardar quem criou o serviço
    ownerId: uid 
  };

  try {
    // AQUI ESTÁ A MUDANÇA PRINCIPAL:
    // Criamos a referência da coleção dentro da pasta do usuário.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    
    await addDoc(servicosUserCollection, novoServico);
    
    alert("Serviço salvo com sucesso!");
    window.location.href = 'servicos.html'; // Volta para a lista de serviços
  } catch (error) {
    console.error("Erro ao salvar serviço: ", error);
    alert("Erro ao salvar o serviço.");
  }
}
    Toastify({ text: "Falha ao cadastrar o serviço.", style: { background: "var(--cor-perigo)" } }).showToast();
  }
});
