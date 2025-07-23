/**
 * perfil.js (Versão Simplificada para Teste)
 * * Este script remove temporariamente a lógica de upload de logótipo
 * * para isolar e corrigir o erro ao salvar o perfil.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
// Removida a importação do Storage por enquanto
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
// Elementos do link (mantidos para consistência)
const linkContainer = document.getElementById('link-vitrine-container');
const linkGeradoInput = document.getElementById('link-gerado');
const btnCopiarLink = document.getElementById('btn-copiar-link');

let uid;

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
    if (btnCopiarLink) {
        btnCopiarLink.addEventListener('click', copiarLink);
    }
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
      if (data.slug && linkContainer) {
        mostrarLinkGerado(data.slug);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A salvar...';

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
    // A lógica de verificação de slug e salvamento no Firestore permanece
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
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Perfil';
        return;
    }

    // Salva os dados de texto no perfil privado e público
    const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
    await setDoc(perfilPrivadoRef, perfilData);

    const perfilPublicoRef = doc(db, "publicProfiles", uid);
    await setDoc(perfilPublicoRef, { slug: perfilData.slug, ownerId: uid });
    
    alert("Perfil salvo com sucesso!");
    if (linkContainer) {
        mostrarLinkGerado(perfilData.slug);
    }

  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    alert("Erro ao salvar o perfil."); // Este é o erro que você está a ver
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Perfil';
  }
}

function mostrarLinkGerado(slug) {
    if (!linkContainer || !linkGeradoInput) return;
    const urlBase = "https://pronti-app.netlify.app/vitrine.html";
    const urlCompleta = `${urlBase}?slug=${slug}`;
    linkGeradoInput.value = urlCompleta;
    linkContainer.style.display = 'block';
}

function copiarLink() {
    if (!linkGeradoInput) return;
    linkGeradoInput.select();
    document.execCommand('copy');
    alert("Link copiado para a área de transferência!");
}


