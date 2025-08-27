// ======================================================================
//          SELECIONAR-EMPRESA.JS
//      Responsabilidade: Carregar e exibir as empresas de um dono,
//      permitindo a seleção ou a criação de uma nova.
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- ELEMENTOS DO DOM ---
const grid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o utilizador estiver logado, busca as suas empresas
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Utilizador';
        tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        carregarEmpresas(user.uid);
    } else {
        // Se não estiver logado, redireciona para a página de login
        window.location.href = 'login.html';
    }
});

/**
 * Busca no Firestore todas as empresas associadas a um dono e renderiza na tela.
 * @param {string} donoId - O UID do utilizador autenticado.
 */
async function carregarEmpresas(donoId) {
    try {
        const q = query(collection(db, "empresarios"), where("donoId", "==", donoId));
        const querySnapshot = await getDocs(q);

        grid.innerHTML = ''; // Limpa o loader

        querySnapshot.forEach((doc) => {
            const empresa = doc.data();
            const empresaCard = criarEmpresaCard(doc.id, empresa);
            grid.appendChild(empresaCard);
        });

        // Adiciona sempre o card para criar uma nova empresa
        const criarCard = criarNovoCard();
        grid.appendChild(criarCard);

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        grid.innerHTML = '<p style="color: red;">Não foi possível carregar as suas empresas. Tente novamente.</p>';
    }
}

/**
 * Cria o elemento HTML para um card de empresa.
 * @param {string} id - O ID do documento da empresa.
 * @param {object} data - Os dados da empresa (nomeFantasia, logoUrl, etc.).
 * @returns {HTMLAnchorElement} O elemento do card.
 */
function criarEmpresaCard(id, data) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#'; // Usamos JS para o clique para evitar recarregamento
    card.onclick = () => selecionarEmpresa(id);

    const logoSrc = data.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(data.nomeFantasia?.charAt(0) || "E")}`;

    card.innerHTML = `
        <img src="${logoSrc}" alt="Logo de ${data.nomeFantasia || "Empresa"}" class="empresa-logo">
        <span class="empresa-nome">${data.nomeFantasia || "Empresa sem nome"}</span>
    `;
    return card;
}

/**
 * Cria o card especial para adicionar uma nova empresa.
 * @returns {HTMLAnchorElement} O elemento do card.
 */
function criarNovoCard() {
    const card = document.createElement('a');
    card.className = 'criar-empresa-card';
    card.href = 'perfil.html'; // Redireciona para a página de criação/edição de perfil

    card.innerHTML = `
        <i class="fa-solid fa-plus"></i>
        <span class="empresa-nome">Criar Nova Empresa</span>
    `;
    return card;
}

/**
 * Salva o ID da empresa selecionada e redireciona para o painel principal.
 * @param {string} empresaId - O ID da empresa que foi clicada.
 */
function selecionarEmpresa(empresaId) {
    // Usamos localStorage para que a seleção persista entre abas e sessões
    localStorage.setItem('empresaAtivaId', empresaId);
    // Redirecionamento para index.html
    window.location.href = 'index.html'; 
}

// --- EVENTOS ---
btnLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
});
