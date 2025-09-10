/**
 * @file menu-lateral.js
 * @description Componente autônomo e robusto para o menu lateral.
 * Garante que o menu seja carregado e as permissões aplicadas sem falhas de tempo.
 * @version 5.0.0 - Arquitetura Robusta com Promise
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

/**
 * Atualiza a visibilidade dos links do menu.
 * @param {string} role O papel do usuário.
 */
function updateMenuVisibility(role) {
    console.log(`[menu-lateral.js] Aplicando visibilidade para o papel: ${role}`);
    
    // Teste de diagnóstico: verifica se os elementos existem
    const donoLinks = document.querySelectorAll('.menu-dono');
    console.log(`[menu-lateral.js] Encontrados ${donoLinks.length} links de 'dono'.`);

    // Lógica de visibilidade
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
            if (linkPath === currentPath) {
                link.classList.add('active');
            }
        });
    } catch(e) { /* Ignora erros */ }
}

/**
 * Ponto de entrada: resolve o problema de tempo de carregamento.
 */
(async function inicializar() {
    // Espera o HTML básico da página estar pronto
    await new Promise(resolve => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });

    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) {
        console.error("Erro Crítico: Placeholder '#sidebar-placeholder' não encontrado.");
        return;
    }

    try {
        // Busca o HTML do menu
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");
        
        const html = await response.text();
        placeholder.innerHTML = html;

        // Busca os dados do usuário
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

        // AGORA, com o HTML e os dados prontos, aplica a lógica
        updateMenuVisibility(papel);
        setupMenuFeatures();

    } catch (err) {
        if (!err.message.includes("Redirecionando")) {
            console.error("[menu-lateral.js] Erro na inicialização:", err);
        }
    }
})();
