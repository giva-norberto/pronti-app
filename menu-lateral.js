// ======================================================================
// MENU-LATERAL.JS
// Gerencia o menu lateral, logout e permissões
// ======================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from './userService.js';
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Função para carregar permissões globais do Firestore
async function carregarPermissoesGlobais() {
    try {
        const ref = doc(db, "configuracoesGlobais", "permissoes");
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : {};
    } catch (error) {
        console.error('Erro ao carregar permissões globais:', error);
        return {};
    }
}

export async function ativarMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // --- BOTÃO SAIR ---
    const btnLogout = sidebar.querySelector('#btn-logout');
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                localStorage.clear();
                window.location.href = 'login.html';
            } catch {
                alert('Erro ao sair');
            }
        });
    }

    // --- DESTAQUE DA PÁGINA ATUAL ---
    const links = sidebar.querySelectorAll('.sidebar-links a');
    const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    links.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
        if (linkPage === currentPage) link.classList.add('active');
    });

    // --- PERMISSÕES ---
    try {
        const sessao = await verificarAcesso();
        const papel = sessao.perfil.papel; // 'admin', 'dono', 'funcionario'
        
        // Carregar permissões globais do Firestore
        const permissoesGlobais = await carregarPermissoesGlobais();

        links.forEach(link => {
            const menuId = link.dataset.menuId;
            if (!menuId) return;

            // Verificar se existe permissão global para este menu
            if (permissoesGlobais[menuId] && permissoesGlobais[menuId][papel] !== undefined) {
                // Usar permissão global do Firestore
                link.style.display = permissoesGlobais[menuId][papel] ? '' : 'none';
            } else {
                // Fallback para lógica antiga se não houver permissão global definida
                // Funcionario: só vê menus gerais
                if (papel === 'funcionario' && ['servicos','clientes','perfil','relatorios','administracao','permissoes'].includes(menuId)) {
                    link.style.display = 'none';
                }

                // Dono: não vê menus admin
                if (papel === 'dono' && ['administracao','permissoes'].includes(menuId)) {
                    link.style.display = 'none';
                }

                // Admin: vê todos os menus
                if (papel === 'admin') {
                    link.style.display = '';
                }
            }
        });
        
        // Remover classe de loading após aplicar permissões
        sidebar.classList.remove('sidebar-loading');
        
    } catch(e) {
        console.error('Erro ao aplicar permissões do menu:', e);
        // Em caso de erro, remover classe de loading para mostrar menu básico
        sidebar.classList.remove('sidebar-loading');
    }
}

// Função para observar quando o menu é inserido no DOM
function observarMenuInserido() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                // Verifica se o nó adicionado é o sidebar ou contém o sidebar
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const sidebar = node.id === 'sidebar' ? node : node.querySelector('#sidebar');
                    if (sidebar) {
                        // Menu foi inserido, ativar permissões
                        setTimeout(() => ativarMenu(), 50);
                    }
                }
            });
        });
    });
    
    // Observar mudanças no body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Auto-inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Tentar ativar menu se já existir
    if (document.getElementById('sidebar')) {
        setTimeout(ativarMenu, 100);
    }
    
    // Observar inserção dinâmica do menu
    observarMenuInserido();
});

// Também inicializar quando a página carregar completamente
window.addEventListener('load', () => {
    if (document.getElementById('sidebar')) {
        ativarMenu();
    }
});
