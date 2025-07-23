/**
 * perfil.js (Versão Focada em Salvar Texto)
 * * Este script foi simplificado para salvar apenas os dados de texto do perfil,
 * * contornando temporariamente o erro de CORS do upload de logótipo.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
// A importação do Storage foi removida temporariamente
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
const btnCopiarLink = document.getElementById('btn-copiar-link');
const linkContainer = document.getElementById('link-vitrine-container');
const linkGeradoInput = document.getElementById('link-gerado');

let uid; // Variável para guardar o UID do utilizador autenticado

/**
 * Gera um 'slug' amigável para URL a partir de um texto.
 */
function gerarSlug(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

// Gera o slug automaticamente enquanto o utilizador digita o nome do negócio
nomeNegocioInput.addEventListener('keyup', () => {
    slugInput.value = gerarSlug(nomeNegocioInput.value);
});

// A verificação de login é o "porteiro" da página
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    carregarDadosDoPerfil(uid);
    form.addEventListener('submit', handleFormSubmit);
    btnCopiarLink.addEventListener('click', copiarLink);
  } else {
    window.location.href = 'login.html';
  }
});

/**
 * Carrega os dados do perfil do Firestore e preenche o formulário.
 */
async function carregarDadosDoPerfil(userId) {
  try {
    const perfilRef = doc(db, "users", userId, "publicProfile", "profile");
    const docSnap = await getDoc(perfilRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      nomeNegocioInput.value = data.nomeNegocio || '';
      slugInput.value = data.slug || '';
      descricaoInput.value = data.descricao || '';
      // Se já houver um slug salvo, mostra o link
      if (data.slug) {
        mostrarLinkGerado(data.slug);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

/**
 * Lida com o envio do formulário para salvar/atualizar o perfil (sem logótipo).
 */
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

    btnSalvar.textContent = 'A salvar...';

    const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
    await setDoc(perfilPrivadoRef, perfilData);

    const perfilPublicoRef = doc(db, "publicProfiles", uid);
    await setDoc(perfilPublicoRef, { slug: perfilData.slug, ownerId: uid });
    
    alert("Perfil salvo com sucesso!");
    mostrarLinkGerado(perfilData.slug);

  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    alert("Erro ao salvar o perfil.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Perfil';
  }
}

/**
 * Mostra a secção do link da vitrine com o URL completo.
 */
function mostrarLinkGerado(slug) {
    if (!linkContainer || !linkGeradoInput) return;
    const urlBase = "https://pronti-app.netlify.app/vitrine.html";
    const urlCompleta = `${urlBase}?slug=${slug}`;
    linkGeradoInput.value = urlCompleta;
    linkContainer.style.display = 'block';
}

/**
 * Copia o link da vitrine para a área de transferência.
 */
function copiarLink() {
    const slug = slugInput.value.trim();
    if (!slug) {
        alert("Preencha o campo 'URL da sua Vitrine' para poder copiar o link.");
        return;
    }
    const urlBase = "https://pronti-app.netlify.app/vitrine.html";
    const urlCompleta = `${urlBase}?slug=${slug}`;
    
    const tempInput = document.createElement('input');
    tempInput.value = urlCompleta;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);

    alert("Link copiado para a área de transferência!");
}

