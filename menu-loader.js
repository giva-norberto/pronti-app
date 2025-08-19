import { verificarAcesso } from "./userService.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function montaSidebar(role) {
    if (role === "dono") {
        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand">Pronti</div>
            <nav class="sidebar-links">
                <a href="dashboard.html">Dashboard</a>
                <a href="servicos.html">Serviços</a>
                <a href="agenda.html">Agenda</a>
                <a href="clientes.html">Clientes</a>
                <a href="equipe.html">Equipe</a>
                <a href="perfil.html">Meu Perfil</a>
            </nav>
            <div class="sidebar-footer">
                <button id="btn-logout" class="btn-logout">Sair</button>
            </div>
        </aside>
        `;
    } else if (role === "funcionario") {
        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand">Pronti</div>
            <nav class="sidebar-links">
                <a href="agenda.html">Agenda</a>
                <a href="perfil.html">Meu Perfil</a>
            </nav>
            <div class="sidebar-footer">
                <button id="btn-logout" class="btn-logout">Sair</button>
            </div>
        </aside>
        `;
    }
    return "";
}

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
            }
        };
    }
}

async function inicializarMenuLateral() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return;
    try {
        const acesso = await verificarAcesso();
        placeholder.innerHTML = montaSidebar(acesso.role);
        atribuiLogout();
        // Ativa link da página atual, opcional
        const links = placeholder.querySelectorAll('.sidebar-links a');
        const current = window.location.pathname.split('/').pop().toLowerCase();
        links.forEach(link => {
            if (link.getAttribute('href').toLowerCase() === current) {
                link.classList.add('active');
            }
        });
    } catch (err) {
        placeholder.innerHTML = "";
    }
}
document.addEventListener("DOMContentLoaded", inicializarMenuLateral);
