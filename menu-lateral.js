/**
 * @file menu-lateral.js
 * @description Componente autônomo e inteligente para o menu lateral da aplicação Pronti.
 * Ele injeta o menu na página, aplica permissões, configura logout e destaca o link ativo automaticamente.
 * Versão 5.0.0 - Final com observador de DOM
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

/**
 * Atualiza a visibilidade dos links do menu conforme o papel do usuário.
 */
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

/**
 * Configura o botão logout e destaca o link ativo.
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

    try {
        const currentPath = window.location.pathname;
        document.querySelectorAll('#sidebar-links a').forEach(link => {
            const linkPath = new URL(link.href).pathname;
            link.classList.remove('active');
            if (linkPath === currentPath) link.classList.add('active');
        });
    } catch(e) { /* ignora erros de URL inválida */ }
}

/**
 * Aplica a lógica de permissões ao menu.
 */
async function aplicarLogicaAoMenu() {
    try {
        const userSession = await verificarAcesso();
        let papel = 'funcionario'; // padrão

        if (userSession?.perfil && userSession?.user) {
            const { perfil, user } = userSession;
            if (user.uid === ADMIN_UID) papel = 'admin';
            else if (perfil.ehDono === true) papel = 'dono';
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
 * Função para carregar o menu dentro do placeholder.
 */
async function carregarMenu(placeholder) {
    try {
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");
        placeholder.innerHTML = await response.text();
        await aplicarLogicaAoMenu();
    } catch (err) {
        console.error("[menu-lateral.js] Erro ao carregar menu:", err);
        placeholder.innerHTML = `<p style="color:red; padding:1em;">Erro ao carregar menu.</p>`;
    }
}

/**
 * Inicializa o menu. Se o placeholder não existir ainda, observa o DOM até ele aparecer.
 */
(function inicializarMenu() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (placeholder) {
        carregarMenu(placeholder);
    } else {
        const observer = new MutationObserver(async (mutations, obs) => {
            const pl = document.getElementById('sidebar-placeholder');
            if (pl) {
                await carregarMenu(pl);
                obs.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
