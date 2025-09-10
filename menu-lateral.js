// menu-lateral.js
import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// Atualiza visibilidade dos menus
async function updateMenuWithPermissions(papel) {
    // esconde tudo
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes')
        .forEach(el => el.style.display = 'none');

    // menus básicos por papel
    if (papel === 'funcionario') document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');
    if (papel === 'dono') document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
    if (papel === 'admin') document.querySelectorAll('.menu-dono, .menu-admin, .menu-permissoes').forEach(el => el.style.display = 'flex');

    // pega permissões externas do Firestore
    try {
        const ref = doc(db, "configuracoesGlobais", "permissoes");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const permissoes = snap.data(); // { agenda: { dono: true, funcionario: false, admin: true }, ... }

        Object.entries(permissoes).forEach(([menu, roles]) => {
            if (roles[papel] === true) {
                const el = document.querySelector(`[data-menu="${menu}"]`);
                if (el) el.style.display = 'flex';
            }
        });
    } catch(e) {
        console.error("Erro ao buscar permissões:", e);
    }
}

// Configura logout e link ativo
function setupMenuFeatures() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener("click", () => {
            signOut(auth).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            }).catch(err => console.error("Erro ao deslogar:", err));
        });
    }

    const currentPage = window.location.pathname;
    document.querySelectorAll('#sidebar-links a').forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        link.classList.toggle('active', linkPath === currentPage);
    });
}

// Inicialização
(async () => {
    try {
        const session = await verificarAcesso(); // pega papel e perfil
        const papel = session.perfil.papel;

        await updateMenuWithPermissions(papel);
        setupMenuFeatures();
    } catch (err) {
        console.error("Erro inicializando menu lateral:", err);
        window.location.href = "login.html";
    }
})();
