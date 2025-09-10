// menu-lateral.js
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from './userService.js';

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
            } catch (err) {
                console.error('Erro ao sair:', err);
                alert('Erro ao sair. Tente novamente.');
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

        links.forEach(link => {
            const menuId = link.dataset.menuId;
            if (!menuId) return;

            // Funcionário: esconde menus restritos
            if (papel === 'funcionario' && ['servicos','clientes','perfil','relatorios','administracao','permissoes'].includes(menuId)) {
                link.style.display = 'none';
            }

            // Dono: esconde menus admin
            if (papel === 'dono' && ['administracao','permissoes'].includes(menuId)) {
                link.style.display = 'none';
            }

            // Admin: vê tudo
            if (papel === 'admin') {
                link.style.display = '';
            }
        });
    } catch(e) {
        console.error('Erro ao aplicar permissões do menu:', e);
        // Se erro, esconde todos os menus menos o básico
        links.forEach(link => {
            const menuId = link.dataset.menuId;
            if (['inicio','agenda','equipe'].includes(menuId)) {
                link.style.display = '';
            } else {
                link.style.display = 'none';
            }
        });
    }
}

