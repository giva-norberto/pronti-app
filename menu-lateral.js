/**
 * @file menu-lateral.js
 * @description Componente autônomo que gerencia o menu lateral.
 * @version Final
 */
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// --- Funções Internas do Componente (SEM A PALAVRA 'export') ---

function updateMenuVisibility(role) {
    console.log(`[menu-lateral.js] Aplicando visibilidade para o papel: ${role}`);
    document.querySelectorAll('.menu-dono, .menu-admin').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');
    switch (role?.toLowerCase()) {
        case 'admin':
            document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
        case 'dono':
            document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
            break;
    }
}

function setupMenuFeatures() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener("click", () => signOut(auth).then(() => {
            localStorage.clear();
            window.location.href = "login.html";
        }));
    }
    try {
        const currentPagePath = window.location.pathname;
        document.querySelectorAll('#sidebar-links a').forEach(link => {
            const linkPath = new URL(link.href).pathname;
            link.classList.remove('active');
            if (currentPagePath === linkPath) link.classList.add('active');
        });
    } catch (e) { /* Ignora erros de URL */ }
}

/**
 * Ponto de entrada: A função principal que se auto-executa.
 */
(async function inicializarMenu() {
    // Garante que o script só rode depois que o HTML básico da página estiver pronto
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) {
        console.error("Erro Crítico: O placeholder '#sidebar-placeholder' não foi encontrado.");
        return;
    }

    try {
        // 1. Ele mesmo busca seu próprio HTML
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");
        
        placeholder.innerHTML = await response.text();

        // 2. Ele mesmo busca os dados do usuário
        const userSession = await verificarAcesso();
        let papel = 'funcionario';

        // 3. Ele mesmo determina o papel do usuário
        if (userSession?.perfil && userSession?.user) {
            const { perfil, user } = userSession;
            if (user.uid === ADMIN_UID) {
                papel = 'admin';
            } else if (perfil.ehDono === true) {
                papel = 'dono';
            }
        }

        // 4. Ele mesmo se configura
        updateMenuVisibility(papel);
        setupMenuFeatures();

    } catch (err) {
        if (!err.message.includes("Redirecionando")) {
            console.error("[menu-lateral.js] Erro na inicialização:", err);
        }
    } finally {
        document.body.classList.remove('is-loading');
    }
})();
