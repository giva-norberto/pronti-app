// ======================================================================
//          SELECIONAR-EMPRESA.JS (VERSÃO CORRIGIDA E CENTRALIZADA)
// ======================================================================

// 1. A CORREÇÃO MAIS IMPORTANTE: Importa 'db' e 'auth' do arquivo MESTRE.
import { auth, db } from "./firebase-config.js";
// 2. Importa as funções da versão correta do Firebase (10.13.2)
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- ELEMENTOS DO DOM ---
const grid = document.getElementById('empresas-grid' );
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário já tem uma empresa ativa, ele não deveria estar nesta página.
        // Redireciona para o painel principal para evitar confusão.
        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
        if (empresaAtivaId) {
            window.location.href = 'index.html';
            return; // Interrompe a execução para evitar carregar dados desnecessariamente
        }
        
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
        if (tituloBoasVindas) tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        
        // Chama a função para carregar as empresas do usuário
        carregarEmpresas(user.uid);
    } else {
        // Se não há usuário, volta para a tela de login.
        window.location.href = 'login.html';
    }
});

/**
 * Busca no Firestore todas as empresas associadas a um dono e as renderiza na tela.
 * @param {string} donoId - O UID do usuário autenticado.
 */
async function carregarEmpresas(donoId) {
    if (loader) loader.style.display = "block";
    if (grid) grid.style.display = "none";

    try {
        // Esta linha agora funcionará, pois 'db' é uma instância válida.
        const q = query(collection(db, "empresarios"), where("donoId", "==", donoId));
        const querySnapshot = await getDocs(q);

        if (grid) grid.innerHTML = ''; // Limpa o grid antes de adicionar novos cards

        if (querySnapshot.empty) {
            if (grid) grid.innerHTML = '<p class="nenhuma-empresa-aviso">Você ainda não possui empresas cadastradas.</p>';
        } else {
            querySnapshot.forEach((doc) => {
                const empresa = doc.data();
                const empresaCard = criarEmpresaCard(doc.id, empresa);
                if (grid) grid.appendChild(empresaCard);
            });
        }

        // Adiciona sempre o card para criar uma nova empresa no final da lista.
        const criarCard = criarNovoCard();
        if (grid) grid.appendChild(criarCard);

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        if (grid) grid.innerHTML = '<p style="color: red;">Não foi possível carregar suas empresas. Verifique sua conexão e tente novamente.</p>';
    } finally {
        if (loader) loader.style.display = "none";
        if (grid) grid.style.display = "grid"; // Ou 'flex', dependendo do seu CSS
    }
}

/**
 * Cria o elemento HTML para um card de empresa.
 * @param {string} id - O ID do documento da empresa.
 * @param {object} data - Os dados da empresa.
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

    const nomeFantasia = data.nomeFantasia || "Empresa Sem Nome";
    // Cria uma inicial a partir do nome para o placeholder
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    const logoSrc = data.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial )}`;

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
    card.href = 'perfil.html'; // Leva para a página de criação de perfil/empresa

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

// --- EVENTOS ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            // Limpa a empresa ativa ao fazer logout para evitar inconsistências
            localStorage.removeItem('empresaAtivaId');
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    });
}
