import { verificarAcesso } from "./userService.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * Monta o HTML do menu lateral conforme o papel do usuário.
 */
function montaSidebar(role) {
    if (role === "dono") {
        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand">Pronti</div>
            <nav class="sidebar-links">
                <a href="dashboard.html"><i class="fa-solid fa-gauge"></i> Dashboard</a>
                <a href="servicos.html"><i class="fa-solid fa-scissors"></i> Serviços</a>
                <a href="agenda.html"><i class="fa-solid fa-calendar"></i> Agenda</a>
                <a href="clientes.html"><i class="fa-solid fa-user"></i> Clientes</a>
                <a href="equipe.html"><i class="fa-solid fa-users"></i> Equipe</a>
                <a href="perfil.html"><i class="fa-solid fa-user-gear"></i> Meu Perfil</a>
            </nav>
            <div class="sidebar-footer">
                <button id="btn-logout" class="btn-logout" aria-label="Sair">Sair</button>
            </div>
        </aside>
        `;
    } else if (role === "funcionario") {
        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand">Pronti</div>
            <nav class="sidebar-links">
                <a href="agenda.html"><i class="fa-solid fa-calendar"></i> Agenda</a>
                <a href="perfil.html"><i class="fa-solid fa-user"></i> Meu Perfil</a>
            </nav>
            <div class="sidebar-footer">
                <button id="btn-logout" class="btn-logout" aria-label="Sair">Sair</button>
            </div>
        </aside>
        `;
    }
    return "";
}

/**
 * Atribui o evento ao botão sair.
 */
function atribuiLogout() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.onclick = async function () {
            try {
                localStorage.clear();
                sessionStorage.clear();
                await signOut(getAuth());
                window.location.href = "login.html";
            } catch (err) {
                alert("Erro ao sair. Tente novamente.");
                console.error("Erro ao fazer logout:", err);
            }
        };
    }
}

/**
 * Inicializa o menu lateral.
 */
async function inicializarMenuLateral() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return;
    try {
        const acesso = await verificarAcesso();
        placeholder.innerHTML = montaSidebar(acesso.role);
        atribuiLogout();
        // Ativar menu corrente (opcional)
        const links = placeholder.querySelectorAll('.sidebar-links a');
        const current = window.location.pathname.split('/').pop().toLowerCase();
        links.forEach(link => {
            const href = link.getAttribute('href').split('?')[0].toLowerCase();
            if (href === current) link.classList.add('active');
        });
    } catch (err) {
        placeholder.innerHTML = "";
        // Se não logado ou sem permissão, não mostra menu
    }
}

document.addEventListener("DOMContentLoaded", inicializarMenuLateral);
