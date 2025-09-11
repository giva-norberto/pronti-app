// menu-lateral.js
import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js"; // <-- Importa o serviço de usuários

function aplicarPermissoes(perfil) {
    const docRef = db.collection("configuracoesGlobais").doc("permissoes");
    docRef.get().then(doc => {
        if (!doc.exists) return;
        const permissoes = doc.data();
        Object.keys(permissoes).forEach(menuId => {
            const podeVer = permissoes[menuId]?.[perfil];
            if (!podeVer) document.querySelector(`[data-menu-id="${menuId}"]`)?.classList.add("hidden");
        });
    }).catch(console.error);
}

function ativarLinkAtivo() {
    const url = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === url) link.classList.add('active');
    });
}

function configurarLogout() {
    const btn = document.getElementById("btn-logout");
    if (!btn) return;
    btn.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "login.html");
    });
}

// Garante a classe .hidden
if (!document.querySelector('style[data-permissao]')) {
    const style = document.createElement('style');
    style.dataset.permissao = true;
    style.textContent = `.hidden { display:none !important; }`;
    document.head.appendChild(style);
}

// Carrega e inicializa o menu **sempre após o DOM carregado**
document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.getElementById("sidebar-placeholder");
    if (!placeholder) return;

    try {
        const sessao = await verificarAcesso(); // Consulta Firebase
        const papel = sessao.perfil.papel; // 'dono' ou 'funcionario'

        // Escolhe o menu correto
        const menuFile = papel === "dono" ? "menu-dono.html" : "menu-funcionario.html";
        const res = await fetch(menuFile);
        const html = await res.text();
        placeholder.innerHTML = html;

        // Inicializa funções depois de injetar o menu
        aplicarPermissoes(papel);
        ativarLinkAtivo();
        configurarLogout();

    } catch (err) {
        console.error("Erro ao carregar menu:", err);
        placeholder.innerHTML = `<p style="color:red; padding:1em;">Erro ao carregar menu.</p>`;
    }
});
