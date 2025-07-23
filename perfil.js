/**
 * perfil.js (Versão Final e Estável)
 * * Este script gere a página de perfil do profissional, lida com o
 * * carregamento, validação e salvamento dos dados públicos, e exibe
 * * o link da vitrine para ser partilhado.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Elementos do formulário e da secção do link
const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
const descricaoInput = document.getElementById('descricao');
const btnSalvar = form.querySelector('button[type="submit"]');
const linkContainer = document.getElementById('link-vitrine-container');
const linkGeradoInput = document.getElementById('link-gerado');
const btnCopiarLink = document.getElementById('btn-copiar-link');

let uid; // Variável para guardar o UID do utilizador autenticado

/**
 * Gera um 'slug' amigável para URL a partir de um texto.
 * @param {string} texto - O texto a ser convertido.
 * @returns {string} O slug gerado.
 */
function gerarSlug(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, '-')           // Substitui espaços por -
    .replace(/[^\w\-]+/g, '')       // Remove caracteres especiais
    .replace(/\-\-+/g, '-');        // Remove hífens duplicados
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
    if (btnCopiarLink) {
        btnCopiarLink.addEventListener('click', copiarLink);
    }
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
    const perfilRef = doc(db, "users", userId, "publicProfile", "profile");
    const docSnap = await getDoc(perfilRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      nomeNegocioInput.value = data.nomeNegocio || '';
      slugInput.value = data.slug || '';
      descricaoInput.value = data.descricao || '';
      // Se já houver um slug salvo, mostra o link
      if (data.slug && linkContainer) {
        mostrarLinkGerado(data.slug);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

/**
 * Lida com o envio do formulário para salvar/atualizar o perfil.
 * @param {Event} event - O evento de submit.
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
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Perfil';
        return;
    }

    btnSalvar.textContent = 'A salvar...';

    // Salva na pasta segura do utilizador
    const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
    await setDoc(perfilPrivadoRef, perfilData);

    // Salva na coleção pública para a busca da vitrine
    const perfilPublicoRef = doc(db, "publicProfiles", uid);
    await setDoc(perfilPublicoRef, { slug: perfilData.slug, ownerId: uid });
    
    alert("Perfil salvo com sucesso!");
    if (linkContainer) {
        mostrarLinkGerado(perfilData.slug);
    }

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
 * @param {string} slug - O slug do perfil do utilizador.
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
    if (!linkGeradoInput) return;
    linkGeradoInput.select();
    document.execCommand('copy');
    alert("Link copiado para a área de transferência!");
}


