// ======================================================================
//             SELECIONAR-EMPRESA.JS (VERSÃO FINAL REVISADA COM DEBUG)
// - Usa a função centralizada getEmpresasDoUsuario para consistência.
// - Redireciona automaticamente se o utilizador tiver apenas uma empresa.
// - Permite a seleção manual se o utilizador tiver múltiplas empresas.
// - Logs de debug foram adicionados para monitoramento.
// ======================================================================

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getEmpresasDoUsuario } from "./userService.js";

// --- ELEMENTOS DO DOM ---
const grid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- DEBUG GLOBAL ---
window.debugSelecionarEmpresa = {
    grid,
    loader,
    tituloBoasVindas,
    btnLogout,
    empresasCarregadas: null,
    empresaSelecionada: null
};

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 [DEBUG] DOM carregado, iniciando onAuthStateChanged");
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
            if (tituloBoasVindas) tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;

            console.log("🔐 [DEBUG] Usuário autenticado:", user.uid);
            inicializarPagina(user);
        } else {
            console.log("⚠️ [DEBUG] Nenhum usuário logado, redirecionando para login");
            window.location.href = 'login.html';
        }
    });
});

/**
 * Função principal que busca as empresas e controla a interface.
 * @param {object} user - Objeto do usuário autenticado do Firebase.
 */
async function inicializarPagina(user) {
    if (loader) loader.style.display = "block";
    if (grid) grid.style.display = "none";

    try {
        console.log("📋 [DEBUG] Carregando empresas do usuário");
        const empresas = await getEmpresasDoUsuario(user);
        window.debugSelecionarEmpresa.empresasCarregadas = empresas;

        // --- LÓGICA DE DECISÃO ---
        if (empresas.length === 1) {
            console.log(`ℹ️ Apenas uma empresa encontrada (${empresas[0].nomeFantasia || empresas[0].nome}). Redirecionando...`);
            selecionarEmpresa(empresas[0].id);
            return;
        }

        console.log(`ℹ️ ${empresas.length} empresas encontradas. Renderizando opções...`);
        renderizarOpcoes(empresas);

    } catch (error) {
        console.error("❌ [ERROR] Erro ao carregar empresas:", error);
        if (grid) grid.innerHTML = '<p class="nenhuma-empresa-aviso" style="color: red;">Não foi possível carregar as suas empresas.</p>';
    } finally {
        if (loader) loader.style.display = "none";
        if (grid) grid.style.display = "grid";
    }
}

/**
 * Renderiza os cards das empresas e o card de "Criar Nova".
 * @param {Array<object>} empresas - Lista de empresas do usuário.
 */
function renderizarOpcoes(empresas) {
    if (!grid) return;
    grid.innerHTML = '';

    if (empresas.length === 0) {
        console.log("ℹ️ Nenhuma empresa encontrada para renderizar");
        grid.innerHTML = '<p class="nenhuma-empresa-aviso">Você ainda não possui empresas cadastradas.</p>';
    } else {
        empresas.forEach(empresa => {
            const empresaCard = criarEmpresaCard(empresa);
            grid.appendChild(empresaCard);
        });
    }

    const cardCriar = criarNovoCard();
    grid.appendChild(cardCriar);
}

/**
 * Cria o elemento HTML para um card de empresa.
 * @param {object} empresa - Objeto da empresa.
 * @returns {HTMLAnchorElement} Elemento do card.
 */
function criarEmpresaCard(empresa) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#';
    card.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("🖱️ [DEBUG] Empresa clicada:", empresa.id);
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
 * @returns {HTMLAnchorElement} Elemento do card.
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
 * @param {string} empresaId - ID da empresa.
 */
function selecionarEmpresa(empresaId) {
    console.log("✅ [DEBUG] Selecionando empresa:", empresaId);
    localStorage.setItem('empresaAtivaId', empresaId);
    window.debugSelecionarEmpresa.empresaSelecionada = empresaId;
    window.location.href = 'index.html';
}

// --- EVENTO DE LOGOUT ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            console.log("🚪 [DEBUG] Logout iniciado");
            localStorage.removeItem('empresaAtivaId');
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("❌ [ERROR] Erro ao fazer logout:", error);
        }
    });
}
