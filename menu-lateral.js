/**
 * @file menu-lateral.js
 * @description Componente autônomo e completo para o menu lateral.
 * Ele contém seu próprio HTML e CSS, injeta-se na página e aplica a lógica
 * de permissões e funcionalidades automaticamente.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final - Arquitetura de Componente Único
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// ======================================================================
//      1. O TEMPLATE HTML E CSS DO MENU AGORA VIVE AQUI DENTRO
// ======================================================================
const menuTemplate = `
<aside class="sidebar" id="sidebar">
    <a href="index.html" class="sidebar-brand">Pronti</a>
    <hr />
    <nav class="sidebar-links" id="sidebar-links">
        <!-- Links de Funcionário -->
        <a href="index.html" class="menu-func"><span>🏠</span> Início</a>
        <a href="agenda.html" class="menu-func"><span>📅</span> Agenda</a>
        <a href="equipe.html" class="menu-func"><span>👥</span> Equipe</a>
        <!-- Links do Dono -->
        <a href="dashboard.html" class="menu-dono" style="display:none;"><span>📊</span> Dashboard</a>
        <a href="servicos.html" class="menu-dono" style="display:none;"><span>🛠️</span> Serviços</a>
        <a href="clientes.html" class="menu-dono" style="display:none;"><span>👤</span> Clientes</a>
        <a href="perfil.html" class="menu-dono" style="display:none;"><span>🙍‍♂️</span> Meu Perfil</a>
        <a href="relatorios.html" class="menu-dono" style="display:none;"><span>📈</span> Relatórios</a>
        <!-- Links do Admin -->
        <a href="admin-clientes.html" class="menu-admin" style="display:none;"><span>🔒</span> Administração</a>
    </nav>
    <div class="sidebar-footer">
        <button id="btn-logout" class="btn-logout">Sair</button>
    </div>
</aside>
<style>
    .sidebar { width: 240px; background: linear-gradient(180deg, #4f46e5 0%, #6366f1 100%); min-height: 100vh; color: #fff; box-shadow: 2px 0 8px rgba(0,0,0,0.05); position: fixed; left: 0; top: 0; bottom: 0; z-index: 10; display: flex; flex-direction: column; padding-top: 24px; box-sizing: border-box; }
    .sidebar-brand { font-size: 2rem; font-weight: 900; color: #fff; text-decoration: none; letter-spacing: 2px; padding: 0 32px 12px 32px; display: block; margin-bottom: 8px; text-align: left; }
    .sidebar hr { margin: 0 32px 16px 32px; border: none; border-top: 1px solid #787cff55; }
    .sidebar-links { display: flex; flex-direction: column; gap: 10px; padding: 0 24px; flex-grow: 1; }
    .sidebar-links a { display: flex; align-items: center; gap: 10px; background: #fff; color: #4f46e5; font-weight: 600; font-size: 1.08em; border-radius: 10px; box-shadow: 0 2px 6px rgba(79,70,229,0.07); transition: all 0.2s ease; padding: 12px 18px; text-align: left; text-decoration: none; letter-spacing: 0.01em; border: 2px solid transparent; }
    .sidebar-links a.active, .sidebar-links a:focus { background: #4f46e5; color: #fff; font-weight: 700; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(79,70,229,0.3); outline: none; }
    .sidebar-links a:hover:not(.active) { background: #f0f1ff; color: #3b2fd6; border-color: #d1d5fa; }
    .sidebar-footer { margin-top: auto; padding: 32px 32px 24px 32px; }
    .btn-logout { background: #fff; color: #4f46e5; border: none; padding: 12px 0; width: 100%; border-radius: 10px; font-weight: bold; font-size: 1.05em; cursor: pointer; transition: background 0.2s, color 0.2s; box-shadow: 0 2px 6px rgba(79,70,229,0.07); border: 2px solid transparent; outline: none; }
    .btn-logout:hover, .btn-logout:focus { background: #4f46e5; color: #fff; border: 2px solid #fff; }
    @media (max-width: 768px) {
        body { flex-direction: column; }
        main.main-content { margin-left: 0; }
        .sidebar { width: 100%; min-height: auto; position: relative; flex-direction: row; align-items: center; padding: 10px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 0.95em; flex-wrap: wrap; }
        .sidebar-brand { font-size: 1.4rem; padding: 0 10px; margin: 0; }
        .sidebar hr { display: none; }
        .sidebar-links { flex-direction: row; gap: 6px; padding: 0 8px; flex-grow: 1; justify-content: flex-start; }
        .sidebar-links a { font-size: 1em; padding: 8px 12px; }
        .sidebar-links a span { display: none; }
        .sidebar-footer { padding: 0 8px; margin: 0; margin-left: auto; }
        .btn-logout { padding: 8px 16px; font-size: 1em; }
    }
</style>
`;

// ======================================================================
//      2. AS FERRAMENTAS (Lógica de UI)
// ======================================================================

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

// ======================================================================
//      3. O "CÉREBRO" (Lógica principal que executa tudo)
// ======================================================================

(async function inicializarMenu() {
    // Espera o HTML básico da página estar pronto
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) {
        console.error("Erro Crítico: O placeholder '#sidebar-placeholder' não foi encontrado.");
        return;
    }

    try {
        // 1. INJETA O HTML E O CSS DO MENU NA PÁGINA (sem 'fetch')
        placeholder.innerHTML = menuTemplate;

        // 2. BUSCA OS DADOS DO USUÁRIO
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

        // 3. APLICA A LÓGICA AO MENU QUE JÁ ESTÁ NA PÁGINA
        updateMenuVisibility(papel);
        setupMenuFeatures();

    } catch (err) {
        if (!err.message.includes("Redirecionando")) {
            console.error("[menu-lateral.js] Erro na inicialização:", err);
        }
    }
})();
