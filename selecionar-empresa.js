// ======================================================================
//          SELECIONAR-EMPRESA.JS (COM REDIRECIONAMENTO AUTOMÁTICO)
// ======================================================================

import { auth, db } from "./firebase-config.js";
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
        // A verificação de empresa ativa continua aqui. Se o usuário recarregar a página
        // de seleção por engano, ele é enviado de volta para o painel.
        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
        if (empresaAtivaId) {
            window.location.href = 'index.html';
            return;
        }
        
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
        if (tituloBoasVindas) tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        
        carregarEmpresas(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

/**
 * Busca as empresas do dono e decide se redireciona ou mostra as opções.
 * @param {string} donoId - O UID do usuário autenticado.
 */
async function carregarEmpresas(donoId) {
    if (loader) loader.style.display = "block";
    if (grid) grid.style.display = "none";

    try {
        const q = query(collection(db, "empresarios"), where("donoId", "==", donoId));
        const querySnapshot = await getDocs(q);

        // ======================================================
        //          A NOVA LÓGICA DE REDIRECIONAMENTO ESTÁ AQUI
        // ======================================================
        // Se encontrou EXATAMENTE uma empresa, entra direto.
        if (querySnapshot.size === 1) {
            const unicaEmpresaDoc = querySnapshot.docs[0];
            console.log(`Apenas uma empresa encontrada (${unicaEmpresaDoc.data().nomeFantasia}). Redirecionando...`);
            selecionarEmpresa(unicaEmpresaDoc.id); // Usa a função que já temos
            return; // Interrompe a execução para não renderizar a página
        }
        // ======================================================

        // Se encontrou 0 ou mais de 1 empresa, o código continua como antes.
        if (loader) loader.style.display = "none";
        if (grid) grid.innerHTML = '';

        if (querySnapshot.empty) {
            if (grid) grid.innerHTML = '<p class="nenhuma-empresa-aviso">Você ainda não possui empresas cadastradas.</p>';
        } else {
            querySnapshot.forEach((doc) => {
                const empresa = doc.data();
                const empresaCard = criarEmpresaCard(doc.id, empresa);
                if (grid) grid.appendChild(empresaCard);
            });
        }

        const criarCard = criarNovoCard();
        if (grid) grid.appendChild(criarCard);

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        if (grid) grid.innerHTML = '<p style="color: red;">Não foi possível carregar suas empresas.</p>';
    } finally {
        // Garante que o loader seja escondido e o grid apareça apenas se não houver redirecionamento.
        if (loader) loader.style.display = "none";
        if (grid) grid.style.display = "grid";
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
    localStorage.setItem('empresaAtivaId', empresaId);
    window.location.href = 'index.html'; 
}

// --- EVENTOS ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            localStorage.removeItem('empresaAtivaId');
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    });
}
