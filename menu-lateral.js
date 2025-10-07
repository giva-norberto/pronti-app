// ======================================================================
// MENU-LATERAL.JS
// Gerencia o menu lateral, logout e permissões
// ======================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from './userService.js';

/**
 * Ativa e configura o menu lateral, incluindo logout, destaque de página e permissões.
 */
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
        link.classList.remove('active');
        const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
        if (linkPage === currentPage) link.classList.add('active');
    });

    // --- PERMISSÕES POR PAPEL ---
    try {
        const sessao = await verificarAcesso();
        const papel = sessao.perfil.papel; // 'admin', 'dono', 'funcionario'

        links.forEach(link => {
            const menuId = link.dataset.menuId;
            if (!menuId) return;

            // Funcionário: vê apenas menus básicos (Início, Dashboard, Agenda, Equipe, Planos)
            if (papel === 'funcionario') {
                // Menus restritos para funcionário
                if (['servicos','clientes','perfil','relatorios','administracao','permissoes'].includes(menuId)) {
                    link.style.display = 'none';
                } else {
                    link.style.display = '';
                }
            }

            // Dono: não vê menus exclusivos de admin
            else if (papel === 'dono') {
                if (['administracao','permissoes'].includes(menuId)) {
                    link.style.display = 'none';
                } else {
                    link.style.display = '';
                }
            }

            // Admin: vê todos os menus
            else if (papel === 'admin') {
                link.style.display = '';
            }
        });
    } catch(e) {
        console.error('Erro ao aplicar permissões do menu:', e);
    }
}
