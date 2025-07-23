/**
 * perfil.js (Versão de Diagnóstico)
 * * Este script remove temporariamente a verificação de slug duplicado
 * * para isolar a causa do erro de permissões ao salvar.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Inicializa o Firebase Storage

// Elementos do formulário
const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
const descricaoInput = document.getElementById('descricao');
const logoInput = document.getElementById('logoNegocio');
const logoPreview = document.getElementById('logo-preview');
const btnSalvar = form.querySelector('button[type="submit"]');
const btnCopiarLink = document.getElementById('btn-copiar-link');

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
      if (data.logoUrl) {
        logoPreview.src = data.logoUrl;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

/**
 * Lida com o envio do formulário para salvar/atualizar o perfil.
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A salvar...';

  const slug = slugInput.value.trim();
  const nomeNegocio = nomeNegocioInput.value.trim();
  const descricao = descricaoInput.value.trim();
  const logoFile = logoInput.files[0];

  if (!nomeNegocio || !slug) {
      alert("O Nome do Negócio e a URL da Vitrine (slug) são obrigatórios.");
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Perfil';
      return;
  }

  try {
    // --- VERIFICAÇÃO DE SLUG REMOVIDA TEMPORARIAMENTE PARA TESTE ---

    let logoUrl = logoPreview.src.startsWith('https://') ? logoPreview.src : null;

    // Se um novo ficheiro de logótipo foi selecionado, faz o upload
    if (logoFile) {
        btnSalvar.textContent = 'A enviar logótipo...';
        const storageRef = ref(storage, `logos/${uid}/${logoFile.name}`);
        const uploadResult = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(uploadResult.ref);
    }
    
    const perfilData = {
        nomeNegocio,
        slug,
        descricao,
        logoUrl, // Adiciona o URL do logótipo aos dados
        ownerId: uid
    };

    // Salva os dados no perfil privado e público
    const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
    await setDoc(perfilPrivadoRef, perfilData);

    const perfilPublicoRef = doc(db, "publicProfiles", uid);
    await setDoc(perfilPublicoRef, { slug: perfilData.slug, ownerId: uid, logoUrl: logoUrl, nomeNegocio: nomeNegocio });
    
    alert("Perfil salvo com sucesso!");

  } catch (error) {
    console.error("ERRO DETALHADO AO SALVAR:", error);
    alert("Erro ao salvar o perfil. Verifique as permissões no Firebase e a consola para mais detalhes.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Perfil';
  }
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
    
    // Cria um input temporário para copiar o texto
    const tempInput = document.createElement('input');
    tempInput.value = urlCompleta;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);

    alert("Link copiado para a área de transferência!");
}

