// menu-lateral.js
import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const perfil = localStorage.getItem("perfil") || "funcionario"; // fallback

// Aplica permissões do Firestore
async function aplicarPermissoesGlobaisMenu() {
    try {
        const docRef = db.collection("configuracoesGlobais").doc("permissoes");
        const doc = await docRef.get();
        if (!doc.exists) return;
        const permissoes = doc.data();
        Object.keys(permissoes).forEach(menuId => {
            const podeVer = permissoes[menuId]?.[perfil];
            if (!podeVer) document.querySelector(`[data-menu-id="${menuId}"]`)?.classList.add("hidden");
        });
    } catch(e) {
        console.error("Erro ao carregar permissões:", e);
    }
}

// Destaca link ativo
function setupMenuLinksAtivos() {
    const urlAtual = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === urlAtual) link.classList.add('active');
    });
}

// Configura botão logout
function setupLogout() {
    const btn = document.getElementById("btn-logout");
    if (btn) btn.addEventListener("click", () => {
        localStorage.clear();
        signOut(auth).then(() => window.location.href = "login.html");
    });
}

// Garante .hidden no CSS
(function() {
    if (!document.querySelector('style[data-permissao]')) {
        const style = document.createElement('style');
        style.setAttribute('data-permissao', 'true');
        style.innerHTML = `.hidden { display: none !important; }`;
        document.head.appendChild(style);
    }
})();

// Inicializa menu em qualquer página
document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.getElementById("sidebar-placeholder");
    if (!placeholder) return;

    try {
        const res = await fetch("menu-lateral.html");
        const html = await res.text();
        placeholder.innerHTML = html;

        // Depois de injetar HTML, aplica lógica
        await aplicarPermissoesGlobaisMenu();
        setupMenuLinksAtivos();
        setupLogout();

    } catch (err) {
        console.error("Erro ao injetar menu:", err);
        placeholder.innerHTML = `<p style="color:red; padding:1em;">Erro ao carregar menu.</p>`;
    }
});
