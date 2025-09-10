// menu-lateral.js
import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

// --- Configura logout e link ativo ---
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

// --- Atualiza visibilidade dos menus (todos visíveis por padrão) ---
async function updateMenuWithPermissions() {
    // Todos os menus visíveis
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes')
        .forEach(el => el.style.display = 'flex');
}

// --- Inicialização ---
(async () => {
    try {
        await verificarAcesso(); // garante que o usuário está logado e pega perfil/papel
        await updateMenuWithPermissions(); // todos menus visíveis
        setupMenuFeatures();
    } catch (err) {
        console.error("Erro inicializando menu lateral:", err);
        window.location.href = "login.html";
    }
})();
