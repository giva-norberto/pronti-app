import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

document.addEventListener("DOMContentLoaded", async () => {
    // ⬇ Aguarda o menu ser carregado pelo fetch
    const waitForSidebar = () => new Promise(resolve => {
        const interval = setInterval(() => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                clearInterval(interval);
                resolve(sidebar);
            }
        }, 50);
    });

    const sidebar = await waitForSidebar();

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
                console.error("Erro ao sair:", err);
                alert("Erro ao sair, tente novamente.");
            }
        });
    }

    // --- DESTAQUE DO LINK ATIVO ---
    const links = sidebar.querySelectorAll('.sidebar-links a');
    const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    links.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
        if (linkPage === currentPage) link.classList.add('active');
    });

    // --- APLICA PERMISSÕES DO USUÁRIO ---
    try {
        const sessao = await verificarAcesso();
        const papelUsuario = sessao.perfil.papel;

        links.forEach(link => {
            const menuId = link.dataset.menuId;
            // Aqui você controla quem vê o menu
            // Dono/admin/funcionario
            if (!menuId) return;
            if (menuId === 'servicos' || menuId === 'financeiro' || menuId === 'perfil') {
                link.style.display = papelUsuario === 'dono' || papelUsuario === 'admin' ? '' : 'none';
            } else if (menuId === 'administracao' || menuId === 'permissoes') {
                link.style.display = papelUsuario === 'admin' ? '' : 'none';
            } else {
                // todos os outros menus (inicio, agenda, equipe, clientes) são visíveis para todos
                link.style.display = '';
            }
        });

    } catch (err) {
        console.error("Erro ao aplicar permissões no menu:", err);
    }
});
