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
        // Se já existe empresa ativa, não precisa selecionar novamente
        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
        if (empresaAtivaId) {
            window.location.href = 'index.html';
            return;
        }
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Utilizador';
        tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        carregarEmpresas(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

/**
 * Busca no Firestore todas as empresas associadas a um dono e renderiza na tela.
 * @param {string} donoId - O UID do utilizador autenticado.
 */
async function carregarEmpresas(donoId) {
    try {
        // CORREÇÃO: Passe sempre o 'db' como primeiro argumento de collection!
        const q = query(collection(db, "empresarios"), where("donoId", "==", donoId));
        const querySnapshot = await getDocs(q);

        loader.style.display = "none"; // Esconde o loader após carregar

        grid.innerHTML = ''; // Limpa o grid antes de adicionar cards

        if (querySnapshot.empty) {
            grid.innerHTML = '<p style="color: #dc2626; font-weight:bold;">Você ainda não possui empresas cadastradas.</p>';
        }

        querySnapshot.forEach((doc) => {
            const empresa = doc.data();
            const empresaCard = criarEmpresaCard(doc.id, empresa);
            grid.appendChild(empresaCard);
        });

        // Adiciona sempre o card para criar uma nova empresa
        const criarCard = criarNovoCard();
        grid.appendChild(criarCard);

    } catch (error) {
        loader.style.display = "none";
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
    card.href = '#';
    card.onclick = (e) => {
        e.preventDefault();
        selecionarEmpresa(id);
    };

    const nomeFantasia = data.nomeFantasia || "Empresa";
    const logoSrc = data.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(nomeFantasia.charAt(0))}`;

    card.innerHTML = `
        <img src="${logoSrc}" alt="Logo de ${nomeFantasia}" class="empresa-logo">
        <span class="empresa-nome">${nomeFantasia}</span>
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
    card.href = 'perfil.html';

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
    localStorage.setItem('empresaAtivaId', empresaId);
    window.location.href = 'index.html'; 
}

// --- EVENTOS ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    });
}
