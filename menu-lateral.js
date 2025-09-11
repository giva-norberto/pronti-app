// ======================================================================
// MENU-LATERAL.JS - Revisado e Completo
// ======================================================================

import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js"; // Serviço de usuário

// Aplica permissões com base no perfil do usuário
function aplicarPermissoes(perfil) {
    const docRef = db.collection("configuracoesGlobais").doc("permissoes");
    docRef.get().then(doc => {
        if (!doc.exists) return;
        const permissoes = doc.data();

        document.querySelectorAll('.sidebar-links a').forEach(a => {
            const menuId = a.dataset.menuId;
            const podeVer = permissoes[menuId]?.[perfil] ?? true; // Default: visível
            if (!podeVer) a.classList.add("hidden");
        });

        // Administração e Permissões só admin
        if (perfil !== "admin") {
            ["administracao","permissoes"].forEach(id => {
                document.querySelector(`[data-menu-id="${id}"]`)?.classList.add("hidden");
            });
        }

        // Funcionário só vê itens básicos
        if (perfil === "funcionario") {
            ["servicos","clientes","perfil","relatorios"].forEach(id => {
                document.querySelector(`[data-menu-id="${id}"]`)?.classList.add("hidden");
            });
        }
    }).catch(console.error);
}

// Marca o link ativo baseado na URL
function ativarLinkAtivo() {
    const url = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === url) link.classList.add('active');
    });
}

// Configura botão de logout
function configurarLogout() {
    const btn = document.getElementById("btn-logout");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        try {
            await signOut(auth);       // Desloga do Firebase
            localStorage.clear();      // Limpa sessão local
            window.location.href = "login.html";
        } catch (err) {
            console.error("Erro ao sair:", err);
            alert("Erro ao sair: " + err.message);
        }
    });
}

// Garante a classe .hidden
if (!document.querySelector('style[data-permissao]')) {
    const style = document.createElement('style');
    style.dataset.permissao = true;
    style.textContent = `.hidden { display:none !important; }`;
    document.head.appendChild(style);
}

// Inicializa menu após DOM carregado
document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.getElementById("sidebar-placeholder");
    if (!placeholder) return;

    try {
        const sessao = await verificarAcesso();
        const perfil = sessao?.perfil?.papel || "funcionario"; // Perfil padrão: funcionário

        // Seleciona menu correto
        const menuFile = perfil === "dono" ? "menu-dono.html" : "menu-funcionario.html";
        const res = await fetch(menuFile);
        const html = await res.text();
        placeholder.innerHTML = html;

        // Inicializa funcionalidades após injetar HTML
        aplicarPermissoes(perfil);
        ativarLinkAtivo();
        configurarLogout();
    } catch (err) {
        console.error("Erro ao carregar menu:", err);
        placeholder.innerHTML = `<p style="color:red; padding:1em;">Erro ao carregar menu.</p>`;
    }
});
