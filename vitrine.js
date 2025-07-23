// vitrine.js
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';

async function carregarVitrine() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('uid');

  if (!slug) {
    document.body.innerHTML = '<p>UID do empresário não informado na URL.</p>';
    return;
  }

  try {
    const queryRef = doc(db, `users/${slug}/publicProfile/profile`);
    const snap = await getDoc(queryRef);

    if (!snap.exists()) {
      document.body.innerHTML = '<p>Empresário não encontrado.</p>';
      return;
    }

    const data = snap.data();
    document.getElementById('nome').textContent = data.nomeNegocio;
    document.getElementById('descricao').textContent = data.descricao;
  } catch (err) {
    console.error('Erro ao carregar vitrine:', err);
    document.body.innerHTML = '<p>Erro ao carregar informações.</p>';
  }
}

carregarVitrine();


