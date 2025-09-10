/**
 * @file menu-lateral.js
 * @description Componente autônomo que gerencia o menu e avisa a página quando a sessão do usuário está pronta.
 */

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// --- Atualiza visibilidade do menu ---
function updateMenuVisibility(role, permissoesGlobais = {}) {
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes').forEach(el => el.style.display = 'none');
    
    if (role === 'funcionario') {
        document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');
    }
    if (role === 'dono') {
        document.querySelectorAll('.menu-dono, .menu-func').forEach(el => el.style.display = 'flex');
    }
    if (role === 'admin') {
        document.querySelectorAll('.menu-admin, .menu-dono, .menu-func, .menu-permissoes').forEach(el => el.style.display = 'flex');
    }

    Object.entries(permissoesGlobais).forEach(([menu, roles]) => {
        if (roles[role] === true) {
            const link = document.querySelector(`[data-menu="${menu}"]`);
            if (link) link.style.display = 'flex';
        }
    });
}

// --- Configura recursos do menu (logout e link ativo) ---
function setupMenuFeatures() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener("click", () => {
            signOut(auth).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            }).catch(err => console.error("[menu-lateral] erro ao deslogar:", err));
        });
    }

    try {
        const currentPagePath = window.location.pathname;
        document.querySelectorAll('#sidebar-links a').forEach(link => {
            const linkPath = new URL(link.href, window.location.origin).pathname;
            link.classList.toggle('active', linkPath === currentPagePath);
        });
    } catch (e) {
        console.warn("[menu-lateral] erro ao destacar link ativo:", e);
    }
}

// --- Função principal ---
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

        // Pega sessão do usuário
        let userSession = null;
        try {
            const user = auth.currentUser;
            if (!user) return;
            const empresaId = localStorage.getItem("empresaAtivaId");
            if (!empresaId) return;

            const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
            const profSnap = await getDoc(profRef);
            let perfil = profSnap.exists() ? profSnap.data() : {};
            userSession = { user, perfil };
        } catch(e) {
            console.error("[menu-lateral] erro ao obter sessão:", e);
        }

        // Define papel
        let papel = 'funcionario';
        if (userSession?.user) {
            if (userSession.user.uid === ADMIN_UID) papel = 'admin';
            else if (userSession.perfil?.ehDono === true) papel = 'dono';
        }

        // Busca permissões globais (opcional)
        let permissoesGlobais = {};
        try {
            const cfgRef = doc(db, "configuracoesGlobais", "permissoes");
            const snap = await getDoc(cfgRef);
            if (snap.exists()) permissoesGlobais = snap.data();
        } catch(e) {
            console.error("[menu-lateral] erro ao buscar permissões globais:", e);
        }

        updateMenuVisibility(papel, permissoesGlobais);

        // ⚡ Garantir que logout funcione após menu injetado
        setupMenuFeatures();

        // Dispara evento global para páginas que dependem da sessão
        const sessionEvent = new CustomEvent('pronti:session-loaded', { detail: { userSession } });
        document.dispatchEvent(sessionEvent);

    } catch (err) {
        console.error("[menu-lateral] erro na inicialização:", err);
    }
})();
