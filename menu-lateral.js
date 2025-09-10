import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// --- Atualiza menu considerando papel + permissões globais ---
export async function updateMenuVisibility(role = "funcionario") {
    // Esconde tudo
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes').forEach(el => el.style.display = 'none');

    // Mostra menus básicos por papel
    if (role === 'funcionario') document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');
    if (role === 'dono') document.querySelectorAll('.menu-func, .menu-dono').forEach(el => el.style.display = 'flex');
    if (role === 'admin') document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes').forEach(el => el.style.display = 'flex');

    // Busca permissões globais
    try {
        const ref = doc(db, "configuracoesGlobais", "permissoes");
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const permissoesGlobais = snap.data();
            Object.entries(permissoesGlobais).forEach(([menu, roles]) => {
                if (roles[role] === true) {
                    const el = document.querySelector(`[data-menu="${menu}"]`);
                    if (el) el.style.display = 'flex';
                }
            });
        }
    } catch(e) {
        console.error("[menu-lateral] erro ao buscar permissões globais:", e);
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

    const currentPage = window.location.pathname;
    document.querySelectorAll('#sidebar-links a').forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        link.classList.toggle('active', linkPath === currentPage);
    });
}

// --- Inicialização principal ---
(async function inicializarMenu() {
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return;

    try {
        // Carrega menu externo
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error("Falha ao carregar menu-lateral.html");
        placeholder.innerHTML = await response.text();

        await new Promise(resolve => setTimeout(resolve, 50));

        // Usuário atual
        const user = auth.currentUser;
        let perfil = {};
        if (user) {
            const empresaId = localStorage.getItem("empresaAtivaId");
            if (empresaId) {
                const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
                const profSnap = await getDoc(profRef);
                perfil = profSnap.exists() ? profSnap.data() : {};
            }
        }

        // Determina papel
        let papel = "funcionario";
        if (user?.uid === ADMIN_UID) papel = 'admin';
        else if (perfil?.ehDono === true) papel = 'dono';

        // Atualiza menu com permissões globais
        await updateMenuVisibility(papel);
        setupMenuFeatures();

        // Dispara evento global
        document.dispatchEvent(new CustomEvent('pronti:session-loaded', { detail: { userSession: { user, perfil } } }));

    } catch (err) {
        console.error("[menu-lateral] erro na inicialização:", err);
    }
})();
