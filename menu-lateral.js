// ======================================================================
// MENU-LATERAL.JS - Versão Final e Autônoma
// ======================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * Função principal que ativa todo o menu lateral.
 * É exportada para ser chamada pela página que o carrega (ex: index.html ).
 */
export function ativarMenuLateral() {
    marcarLinkAtivo();
    configurarBotaoLogout(); // Garante que o logout sempre funcione.
}

/**
 * Marca o link da página atual como 'ativo' no menu.
 */
function marcarLinkAtivo() {
    const urlAtual = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === urlAtual) {
            link.classList.add('active');
        }
    });
}

/**
 * Encontra o botão de logout e adiciona o evento de clique a ele.
 * Esta é a solução definitiva para o botão que "parou de funcionar".
 */
function configurarBotaoLogout() {
    const btnLogout = document.getElementById("btn-logout");
    if (!btnLogout) {
        console.error("Botão de logout não encontrado. Verifique se o menu-lateral.html tem um botão com id='btn-logout'.");
        return;
    }

    // Técnica para evitar múltiplos eventos de clique em navegações de SPA.
    const btnClone = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(btnClone, btnLogout);

    btnClone.addEventListener("click", async () => {
        try {
            await signOut(auth);
            localStorage.clear(); // Limpa toda a sessão para segurança.
            window.location.href = "login.html";
        } catch (err) {
            console.error("❌ Erro ao fazer logout:", err);
            alert("Não foi possível sair. Tente novamente.");
        }
    });
}
