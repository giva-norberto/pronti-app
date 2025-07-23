/**
 * perfil.js
 * * Este script gere a página de perfil do profissional.
 * Ele carrega os dados do perfil público do Firestore e permite
 * que o utilizador os salve.
 */

import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Elementos do formulário
const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
const descricaoInput = document.getElementById('descricao');
const btnSalvar = form.querySelector('button[type="submit"]');

let uid; // Variável para guardar o UID do utilizador autenticado

/**
 * Função para gerar um 'slug' a partir do nome do negócio.
 * Ex: "Barbearia do João" -> "barbearia-do-joao"
 */
function gerarSlug(texto) {
  if (!texto) return "";
  return texto
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, '-')           // Substitui espaços por -
    .replace(/[^\w\-]+/g, '')       // Remove caracteres especiais que não sejam letras, números ou hífen
    .replace(/\-\-+/g, '-');        // Substitui múltiplos - por um único -
}

// Listener para gerar o slug automaticamente quando o nome do negócio é digitado
nomeNegocioInput.addEventListener('keyup', () => {
    slugInput.value = gerarSlug(nomeNegocioInput.value);
});

// Verifica o estado de autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    carregarDadosDoPerfil(uid);
    form.addEventListener('submit', handleFormSubmit);
  } else {
    window.location.href = 'login.html';
  }
});

/**
 * Carrega os dados do perfil do Firestore e preenche o formulário.
 * @param {string} userId - O ID do utilizador autenticado.
 */
async function carregarDadosDoPerfil(userId) {
  try {
    // A referência agora aponta para um documento específico chamado 'profile'
    const perfilRef = doc(db, "users", userId, "publicProfile", "profile");
    const docSnap = await getDoc(perfilRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      nomeNegocioInput.value = data.nomeNegocio || '';
      slugInput.value = data.slug || '';
      descricaoInput.value = data.descricao || '';
      console.log("Perfil carregado com sucesso:", data);
    } else {
      console.log("Nenhum perfil encontrado. O utilizador pode criar um novo.");
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    alert("Não foi possível carregar os dados do seu perfil.");
  }
}

/**
 * Lida com o envio do formulário para salvar/atualizar o perfil.
 * @param {Event} event - O evento de submit.
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A salvar...';

  const perfilData = {
    nomeNegocio: nomeNegocioInput.value.trim(),
    slug: slugInput.value.trim(),
    descricao: descricaoInput.value.trim(),
    ownerId: uid // Guarda o ID do dono para referência
  };

  if (!perfilData.nomeNegocio || !perfilData.slug) {
      alert("O Nome do Negócio e a URL da Vitrine (slug) são obrigatórios.");
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Perfil';
      return;
  }

  try {
    // A referência aponta para o documento 'profile' dentro da subcoleção 'publicProfile'
    const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
    
    // setDoc irá criar o documento se ele não existir, ou sobrescrevê-lo se já existir.
    await setDoc(perfilRef, perfilData);
    
    alert("Perfil salvo com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    alert("Erro ao salvar o perfil.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Perfil';
  }
}
