// ======================================================================
//   SELECIONAR-EMPRESA.JS (VERSÃO FINAL REVISADA - COMPATÍVEL COM MAPAUSUARIOS EMPRESAS ARRAY)
// - Usa a função centralizada getEmpresasDoUsuario para consistência (compatível com array empresas em mapaUsuarios).
// - Redireciona automaticamente se o utilizador tiver apenas uma empresa.
// - Permite a seleção manual se o utilizador tiver múltiplas empresas.
// ======================================================================

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// Importa a função correta e centralizada para buscar as empresas
import { getEmpresasDoUsuario } from "./userService.js";

// --- ELEMENTOS DO DOM ---
const grid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
            // ✨ CORREÇÃO: A string agora é um template literal (usa crases ``)
            if (tituloBoasVindas) tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
            
            inicializarPagina(user);
        } else {
            // Se não houver utilizador, redireciona para o login
            window.location.href = 'login.html';
        }
    });
});

/**
 * Função principal que busca as empresas e controla a interface.
 * @param {object} user - O objeto do utilizador autenticado do Firebase.
 */
async function inicializarPagina(user) {
    if (loader) loader.style.display = "block";
    if (grid) grid.style.display = "none";

    try {
        // Utiliza a função centralizada do userService para garantir consistência (compatível com array empresas em mapaUsuarios)
        const empresas = await getEmpresasDoUsuario(user);

        // --- LÓGICA DE DECISÃO INTELIGENTE ---
        if (empresas.length === 1) {
            // Se o utilizador tem exatamente uma empresa, seleciona-a automaticamente.
            // ✨ CORREÇÃO: A string agora é um template literal (usa crases ``)
            console.log(`Apenas uma empresa encontrada (${empresas[0].nomeFantasia || empresas[0].nome}). Redirecionando...`);
            selecionarEmpresa(empresas[0].id);
            return; // Interrompe a função para evitar renderizar a página
        }

        // Se tiver 0 ou mais de 1 empresa, mostra as opções na tela.
        renderizarOpcoes(empresas);

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        if (grid) grid.innerHTML = '<p class="nenhuma-empresa-aviso" style="color: red;">Não foi possível carregar as suas empresas.</p>';
    } finally {
        if (loader) loader.style.display = "none";
        if (grid) grid.style.display = "grid";
    }
}

/**
 * Renderiza os cards das empresas e o card de "Criar Nova".
 * @param {Array<object>} empresas - A lista de empresas do utilizador.
 */
function renderizarOpcoes(empresas) {
    if (!grid) return;
    grid.innerHTML = ''; // Limpa o grid antes de adicionar novos elementos

    if (empresas.length === 0) {
        grid.innerHTML = '<p class="nenhuma-empresa-aviso">Você ainda não possui empresas cadastradas.</p>';
    } else {
        empresas.forEach(empresa => {
            const empresaCard = criarEmpresaCard(empresa);
            grid.appendChild(empresaCard);
        });
    }

    // Adiciona sempre o card para criar uma nova empresa
    const cardCriar = criarNovoCard();
    grid.appendChild(cardCriar);
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
        selecionarEmpresa(empresa.id);
    });

    const nomeFantasia = empresa.nomeFantasia || empresa.nome || "Empresa Sem Nome";
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    // ✨ CORREÇÃO: A string da URL agora é um template literal (usa crases ``)
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial)}`;

    // ✨ CORREÇÃO: O HTML agora está dentro de um template literal (usa crases ``)
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
    card.href = 'perfil.html'; // Página para criar/editar perfil/empresa

    // ✨ CORREÇÃO: O HTML agora está dentro de um template literal (usa crases ``)
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
    localStorage.setItem('empresaAtivaId', empresaId);
    window.location.href = 'index.html';
}

// --- EVENTO DE LOGOUT ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            // Limpa a empresa ativa antes de fazer logout para evitar inconsistências
            localStorage.removeItem('empresaAtivaId');
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    });
}
