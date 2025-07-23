/**
 * perfil.js (Versão Corrigida com Escrita Pública)
 * * Este script agora salva o perfil em dois locais:
 * 1. Na pasta segura do utilizador (para gestão).
 * 2. Numa nova coleção pública 'publicProfiles' (para a vitrine encontrar o slug).
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
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

function gerarSlug(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

nomeNegocioInput.addEventListener('keyup', () => {
    slugInput.value = gerarSlug(nomeNegocioInput.value);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    carregarDadosDoPerfil(uid);
    form.addEventListener('submit', handleFormSubmit);
  } else {
    window.location.href = 'login.html';
  }
});

async function carregarDadosDoPerfil(userId) {
  try {
    const perfilRef = doc(db, "users", userId, "publicProfile", "profile");
    const docSnap = await getDoc(perfilRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      nomeNegocioInput.value = data.nomeNegocio || '';
      slugInput.value = data.slug || '';
      descricaoInput.value = data.descricao || '';
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A verificar...';

  const perfilData = {
    nomeNegocio: nomeNegocioInput.value.trim(),
    slug: slugInput.value.trim(),
    descricao: descricaoInput.value.trim(),
    ownerId: uid
  };

  if (!perfilData.nomeNegocio || !perfilData.slug) {
      alert("O Nome do Negócio e a URL da Vitrine (slug) são obrigatórios.");
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Perfil';
      return;
  }

  try {
    // Verifica se o slug já está a ser utilizado por outro profissional
    const publicProfilesRef = collection(db, "publicProfiles");
    const q = query(publicProfilesRef, where("slug", "==", perfilData.slug));
    const querySnapshot = await getDocs(q);
    
    let slugJaExiste = false;
    querySnapshot.forEach((doc) => {
        if (doc.data().ownerId !== uid) {
            slugJaExiste = true;
        }
    });

    if (slugJaExiste) {
        alert(`O endereço "${perfilData.slug}" já está a ser utilizado. Por favor, escolha outro.`);
        return;
    }

    btnSalvar.textContent = 'A salvar...';

    // Salva na pasta segura do utilizador
    const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
    await setDoc(perfilPrivadoRef, perfilData);

    // Salva na nova coleção pública para busca
    const perfilPublicoRef = doc(db, "publicProfiles", uid);
    await setDoc(perfilPublicoRef, { slug: perfilData.slug, ownerId: uid });
    
    alert("Perfil salvo com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    alert("Erro ao salvar o perfil.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Perfil';
  }
}

