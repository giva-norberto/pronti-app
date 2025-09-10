/**
 * @file menu-lateral.js
 * @description Componente autônomo e inteligente para o menu lateral da aplicação Pronti.
 * Ele injeta o menu na página, aplica permissões e configura interações automaticamente.
 * @version 4.1.0 - Versão final com auto-execução de módulo
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
    // Esconde todos os links privados primeiro para garantir um estado limpo
    document.querySelectorAll('.menu-dono, .menu-admin').forEach(el => el.style.display = 'none');
    // Mostra sempre os links básicos (funcionário)
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
    // Logout
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

    // Link ativo
    try {
        const currentPath = window.location.pathname;
        document.querySelectorAll('#sidebar-links a').forEach(link => {
            const linkPath = new URL(link.href).pathname;
            link.classList.remove('active'); // Limpa todos primeiro
            if (linkPath === currentPath) {
                link.classList.add('active');
            }
        });
    } catch(e) { /* Ignora erros de URL inválida */ }
}

/**
 * Aplica lógica de permissões ao menu.
 */
async function aplicarLogicaAoMenu() {
    try {
        const userSession = await verificarAcesso();

        // ==========================================================
        //      ⭐ ALTERAÇÃO: LINHAS DE DIAGNÓSTICO ADICIONADAS
        // ==========================================================
        console.log("--- DIAGNÓSTICO FINAL ---");
        console.log("DADOS RECEBIDOS DO userService:", userSession);
        // ==========================================================

        let papel = 'funcionario'; // Assume o papel mais baixo por padrão

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
 * Ponto de entrada: inicializa o menu, injeta HTML e aplica lógica.
 */
(async function inicializarMenu() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) {
        console.warn("[menu-lateral.js] Nenhum placeholder '#sidebar-placeholder' encontrado na página.");
        return;
    }

    try {
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar o template menu-lateral.html");
        
        const html = await response.text();
        placeholder.innerHTML = html;

        // Depois de injetar o HTML, aplica as permissões e funcionalidades.
        await aplicarLogicaAoMenu();

    } catch (err) {
        console.error("[menu-lateral.js] Erro fatal ao inicializar menu:", err);
        placeholder.innerHTML = `<p style="color:red; padding:1em;">Erro ao carregar menu.</p>`;
    }
})(); // <-- A função é chamada imediatamente ao final da sua definição
