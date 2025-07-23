import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
const descricaoInput = document.getElementById('descricao');
const linkVitrine = document.getElementById('linkVitrine');

let uid;

// Gera slug
function gerarSlug(texto) {
  return texto.toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

nomeNegocioInput.addEventListener('keyup', () => {
  slugInput.value = gerarSlug(nomeNegocioInput.value);
});

// Autenticação
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

      if (data.slug) {
        linkVitrine.innerHTML = `
          <p>Veja sua página pública: 
            <a href="vitrine.html?slug=${data.slug}" target="_blank">
              pronti.app.br/vitrine.html?slug=${data.slug}
            </a>
          </p>`;
      }

    } else {
      console.log("Perfil não encontrado. Novo perfil será criado.");
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const perfilData = {
    nomeNegocio: nomeNegocioInput.value,
    slug: slugInput.value,
    descricao: descricaoInput.value,
    ownerId: uid
  };

  try {
    const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
    await setDoc(perfilRef, perfilData);
    alert("Perfil salvo com sucesso!");

    linkVitrine.innerHTML = `
      <p>Veja sua página pública: 
        <a href="vitrine.html?slug=${perfilData.slug}" target="_blank">
          pronti.app.br/vitrine.html?slug=${perfilData.slug}
        </a>
      </p>`;
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    alert("Erro ao salvar perfil.");
  }
}
