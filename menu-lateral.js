/**
 * @file menu-lateral.js
 * @description Menu lateral autônomo e inteligente para Pronti
 * @version 5.0 - Funcional e sem reload
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

/**
 * Atualiza visibilidade dos links do menu conforme o papel do usuário.
 */
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

/**
 * Destaca link ativo e configura botão de logout
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

    const currentHref = window.location.pathname.split("/").pop(); // pega apenas o arquivo atual
    document.querySelectorAll('#sidebar-links a').forEach(link => {
        link.classList.remove('active');
        const linkHref = link.getAttribute('href').split("/").pop();
        if (linkHref === currentHref) link.classList.add('active');
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
            } else if (perfil.ehDono) {
                papel = 'dono';
            }
        }

        updateMenuVisibility(papel);
        setupMenuFeatures();

    } catch (err) {
        console.error("[menu-lateral.js] Erro ao aplicar lógica:", err);
    }
}

/**
 * Inicializa o menu: injeta HTML e aplica lógica
 */
(async function inicializarMenu() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return console.warn("[menu-lateral.js] Nenhum placeholder encontrado.");

    try {
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");

        placeholder.innerHTML = await response.text();
        await aplicarLogicaAoMenu();

    } catch (err) {
        console.error("[menu-lateral.js] Erro ao inicializar menu:", err);
        placeholder.innerHTML = `<p style="color:red;padding:1em;">Erro ao carregar menu.</p>`;
    }
})();
