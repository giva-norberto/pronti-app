// perfil.js
import { db, auth } from './firebase-config.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js';

const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
const descricaoInput = document.getElementById('descricao');

let currentUid = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    const docRef = doc(db, `users/${currentUid}/publicProfile/profile`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      nomeNegocioInput.value = data.nomeNegocio || '';
      slugInput.value = data.slug || '';
      descricaoInput.value = data.descricao || '';
    }
  } else {
    alert('Você precisa estar logado.');
    window.location.href = 'login.html';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUid) return;

  const data = {
    nomeNegocio: nomeNegocioInput.value.trim(),
    slug: slugInput.value.trim().toLowerCase(),
    descricao: descricaoInput.value.trim()
  };

  await setDoc(doc(db, `users/${currentUid}/publicProfile/profile`), data);
  alert('Perfil salvo com sucesso!');
});
