/**
 * @file menu-lateral.js
 * @description Componente autônomo que gerencia o menu e avisa a página quando a sessão do usuário está pronta.
 * @version Final com Event Dispatcher
 */
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// --- Funções Internas do Componente (SEM ALTERAÇÕES) ---
function updateMenuVisibility(role) { /* ...código original... */ }
function setupMenuFeatures() { /* ...código original... */ }

// Para garantir, aqui estão as funções que não foram alteradas
function updateMenuVisibility(role) {
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
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return;

    try {
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");
        
        placeholder.innerHTML = await response.text();

        const userSession = await verificarAcesso();
        
        // ⭐ ATUALIZAÇÃO: Dispara um evento global avisando que a sessão está pronta.
        const sessionEvent = new CustomEvent('pronti:session-loaded', { detail: { userSession } });
        document.dispatchEvent(sessionEvent);

        let papel = 'funcionario';
        if (userSession?.perfil && userSession?.user) {
            const { perfil, user } = userSession;
            if (user.uid === ADMIN_UID) {
                papel = 'admin';
            } else if (perfil.ehDono === true) {
                papel = 'dono';
            }
        }
        updateMenuVisibility(papel);
        setupMenuFeatures();
    } catch (err) {
        if (!err.message.includes("Redirecionando")) {
            console.error("[menu-lateral.js] Erro na inicialização:", err);
        }
    }
})();

