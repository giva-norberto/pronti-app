// selecionar-empresa.js - SÓ FAZ O FRONT DA SELEÇÃO, NÃO CHAMA verificarAcesso!

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './firebase-config.js'; // ajuste conforme o seu projeto

const auth = getAuth();
const empresasGrid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const btnLogout = document.getElementById('btn-logout');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');

async function renderizarEmpresas(user) {
  loader.style.display = 'block';
  empresasGrid.innerHTML = '';

  try {
    const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
    const querySnapshot = await getDocs(q);

    loader.style.display = 'none';

    if (querySnapshot.empty) {
      empresasGrid.innerHTML = '<p>Você não possui empresas cadastradas.</p>';
      return;
    }

    empresasGrid.innerHTML = '';
    querySnapshot.forEach((doc) => {
      const empresa = doc.data();
      const card = document.createElement('div');
      card.className = 'empresa-card';
      card.innerHTML = `
        <img class="empresa-logo" src="${empresa.logoUrl || 'https://via.placeholder.com/70'}" alt="Logo da empresa">
        <div class="empresa-nome">${empresa.nomeFantasia || 'Empresa sem nome'}</div>
        <div style="font-size:0.95rem;color:#64748b;margin-top:6px;">${empresa.descricao || ''}</div>
      `;
      card.onclick = () => selecionarEmpresa(doc.id);
      empresasGrid.appendChild(card);
    });

    // Card para criar nova empresa
    const criarCard = document.createElement('div');
    criarCard.className = 'criar-empresa-card';
    criarCard.innerHTML = `
      <i class="fas fa-plus-circle"></i>
      <div>Criar nova empresa</div>
    `;
    criarCard.onclick = () => window.location.href = 'criar-empresa.html';
    empresasGrid.appendChild(criarCard);

    tituloBoasVindas.textContent = `Bem-vindo(a), ${user.displayName || user.email || 'usuário'}!`;
  } catch (error) {
    loader.style.display = 'none';
    empresasGrid.innerHTML = '<p>Erro ao carregar empresas. Tente novamente.</p>';
    console.error("Erro ao carregar empresas:", error);
  }
}

function selecionarEmpresa(empresaId) {
  localStorage.setItem('empresaAtivaId', empresaId);
  window.location.href = 'painel.html';
}

btnLogout.onclick = async () => {
  await signOut(auth);
  window.location.href = 'login.html';
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    renderizarEmpresas(user);
  } else {
    window.location.href = 'login.html';
  }
});
