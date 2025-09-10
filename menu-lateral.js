/**
 * @file menu-lateral.js
 * @description Componente autônomo para o menu lateral da aplicação Pronti.
 * Injeta o menu na página, aplica permissões e destaca o link ativo automaticamente.
 * @version 5.0.0 - Versão final
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

/**
 * Atualiza visibilidade dos links do menu
 */
function updateMenuVisibility(role) {
    // Esconde todos os links privados primeiro
    document.querySelectorAll('.menu-dono, .menu-admin').forEach(el => el.style.display = 'none');
    // Mostra sempre links de funcionário
    document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');

    switch (role?.toLowerCase()) {
        case 'admin':
            document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
        case 'dono':
            document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
            break;
    }
}

/**
 * Configura logout e destaca o link ativo
 */
function setupMenuFeatures() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener("click", () => {
            signOut(auth).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            });
        });
    }

    const currentURL = window.location.href;
    document.querySelectorAll('#sidebar-links a').forEach(link => {
        link.classList.remove('active');
        // Compara href completo para garantir que o link correto fique ativo
        if (link.href === currentURL || currentURL.endsWith(link.getAttribute('href'))) {
            link.classList.add('active');
        }
    });
}

/**
 * Aplica lógica de permissões
 */
async function aplicarLogicaAoMenu() {
    try {
        const userSession = await verificarAcesso();
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
            console.error("[menu-lateral.js] Erro ao aplicar lógica:", err);
        }
    }
}

/**
 * Inicializa o menu
 */
(async function inicializarMenu() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) {
        console.warn("[menu-lateral.js] Nenhum placeholder '#sidebar-placeholder' encontrado.");
        return;
    }

    try {
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar o template menu-lateral.html");

        placeholder.innerHTML = await response.text();

        // Observa quando o menu foi totalmente injetado no DOM
        const observer = new MutationObserver(async (mutationsList, obs) => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                await aplicarLogicaAoMenu();
                obs.disconnect(); // Para de observar após configurar
            }
        });

        observer.observe(placeholder, { childList: true, subtree: true });

    } catch (err) {
        console.error("[menu-lateral.js] Erro fatal ao inicializar menu:", err);
        placeholder.innerHTML = `<p style="color:red; padding:1em;">Erro ao carregar menu.</p>`;
    }
})();
