/**
 * @file menu-lateral.js
 * @description Menu lateral autônomo e funcional para todos os perfis.
 */

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// --- Atualiza visibilidade do menu por perfil ---
export function updateMenuVisibility(role = "funcionario") {
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes')
            .forEach(el => el.style.display = 'none');

    // Funcionário sempre visível
    document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');

    if (role === 'dono') {
        document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
    }

    if (role === 'admin') {
        document.querySelectorAll('.menu-dono, .menu-admin, .menu-permissoes').forEach(el => el.style.display = 'flex');
    }
}

// --- Configura logout e link ativo ---
export function setupMenuFeatures() {
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

    // Destaca link ativo
    try {
        const currentPage = window.location.pathname;
        document.querySelectorAll('#sidebar-links a').forEach(link => {
            const linkPath = new URL(link.href, window.location.origin).pathname;
            link.classList.toggle('active', linkPath === currentPage);
        });
    } catch (e) { console.warn("[menu-lateral] erro ao marcar link ativo:", e); }
}

// --- Inicialização principal ---
(async function inicializarMenu() {
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return;

    try {
        // Carrega menu via fetch se houver HTML externo
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");
        placeholder.innerHTML = await response.text();

        // Espera o menu estar no DOM antes de manipular
        await new Promise(resolve => setTimeout(resolve, 50));

        // Pega usuário atual
        const user = auth.currentUser;
        let perfil = {};
        if (user) {
            const empresaId = localStorage.getItem("empresaAtivaId");
            if (empresaId) {
                try {
                    const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
                    const profSnap = await getDoc(profRef);
                    perfil = profSnap.exists() ? profSnap.data() : {};
                } catch(e) {
                    console.error("[menu-lateral] erro ao buscar perfil:", e);
                }
            }
        }

        // Determina papel
        let papel = "funcionario";
        if (user?.uid === ADMIN_UID) papel = 'admin';
        else if (perfil?.ehDono === true) papel = 'dono';

        // Atualiza visibilidade e configurações
        updateMenuVisibility(papel);
        setupMenuFeatures();

        // Dispara evento global para páginas que dependem da sessão
        const sessionEvent = new CustomEvent('pronti:session-loaded', { detail: { userSession: { user, perfil } } });
        document.dispatchEvent(sessionEvent);

    } catch (err) {
        console.error("[menu-lateral] erro na inicialização:", err);
    }
})();
