// ======================================================================
//             SELECIONAR-EMPRESA.JS (VERSÃO FINAL REVISADA COM DEBUG)
// ======================================================================

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getEmpresasDoUsuario } from "./userService.js";

// --- ELEMENTOS DO DOM ---
const grid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 [DEBUG] DOM carregado, inicializando onAuthStateChanged...");
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("🔐 [DEBUG] Usuário logado:", user.uid);

            const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
            if (tituloBoasVindas) tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;

            inicializarPagina(user);
        } else {
            console.log("⚠️ [DEBUG] Nenhum usuário logado. Redirecionando para login...");
            window.location.href = 'login.html';
        }
    });
});

/**
 * Função principal que busca as empresas e controla a interface.
 * @param {object} user - O objeto do utilizador autenticado do Firebase.
 */
async function inicializarPagina(user) {
    console.log("📋 [DEBUG] Inicializando página com usuário:", user.uid);
    
    if (loader) loader.style.display = "block";
    if (grid) grid.style.display = "none";

    try {
        const empresas = await getEmpresasDoUsuario(user);
        console.log("✅ [DEBUG] Empresas retornadas pelo userService:", empresas);

        // --- LÓGICA DE DECISÃO INTELIGENTE ---
        if (empresas.length === 1) {
            console.log(`➡️ [DEBUG] Apenas uma empresa encontrada (${empresas[0].nomeFantasia || empresas[0].nome}). Selecionando automaticamente...`);
            selecionarEmpresa(empresas[0].id);
            return; // Interrompe para evitar renderizar opções
        }

        renderizarOpcoes(empresas);

    } catch (error) {
        console.error("❌ [ERROR] Erro ao carregar empresas:", error);
        if (grid) grid.innerHTML = '<p class="nenhuma-empresa-aviso" style="color: red;">Não foi possível carregar as suas empresas.</p>';
    } finally {
        if (loader) loader.style.display = "none";
        if (grid) grid.style.display = "grid";
        console.log("🔧 [DEBUG] Finalizado carregamento de empresas e UI atualizada.");
    }
}

/**
 * Renderiza os cards das empresas e o card de "Criar Nova".
 * @param {Array<object>} empresas - A lista de empresas do utilizador.
 */
function renderizarOpcoes(empresas) {
    if (!grid) return;
    grid.innerHTML = '';
    console.log("📌 [DEBUG] Renderizando opções de empresas...");

    if (empresas.length === 0) {
        grid.innerHTML = '<p class="nenhuma-empresa-aviso">Você ainda não possui empresas cadastradas.</p>';
    } else {
        empresas.forEach(empresa => {
            const empresaCard = criarEmpresaCard(empresa);
            grid.appendChild(empresaCard);
            console.log("✅ [DEBUG] Card criado para empresa:", empresa.nomeFantasia || empresa.nome);
        });
    }

    // Card de criar nova empresa
    const cardCriar = criarNovoCard();
    grid.appendChild(cardCriar);
    console.log("➕ [DEBUG] Card de 'Criar Nova Empresa' adicionado.");
}

/**
 * Cria o elemento HTML para um card de empresa.
 * @param {object} empresa - O objeto da empresa com id e outros dados.
 * @returns {HTMLAnchorElement} O elemento do card.
 */
function criarEmpresaCard(empresa) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#';
    card.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("➡️ [DEBUG] Empresa clicada:", empresa.id);
        selecionarEmpresa(empresa.id);
    });

    const nomeFantasia = empresa.nomeFantasia || empresa.nome || "Empresa Sem Nome";
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial)}`;

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
        <div class="plus-icon">+</div>
        <span class="empresa-nome">Criar Nova Empresa</span>
    `;
    return card;
}

/**
 * Salva o ID da empresa selecionada no localStorage e redireciona para o painel.
 * @param {string} empresaId - O ID da empresa que foi clicada.
 */
function selecionarEmpresa(empresaId) {
    console.log("💾 [DEBUG] Empresa selecionada, salvando localStorage:", empresaId);
    localStorage.setItem('empresaAtivaId', empresaId);
    window.location.href = 'index.html';
}

// --- EVENTO DE LOGOUT ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            console.log("🚪 [DEBUG] Logout iniciado pelo usuário");
            localStorage.removeItem('empresaAtivaId');
            await signOut(auth);
            console.log("✅ [DEBUG] Logout concluído. Redirecionando para login...");
            window.location.href = 'login.html';
        } catch (error) {
            console.error("❌ [ERROR] Erro ao fazer logout:", error);
        }
    });
}

// --- DEBUG GLOBAL ---
window.debugSelecionarEmpresa = {
    selecionarEmpresa,
    getEmpresaAtiva: () => localStorage.getItem('empresaAtivaId')
};
console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugSelecionarEmpresa");
