// ======================================================================
// MENU-LATERAL.JS - Revisado para garantir que o Logout sempre funcione
// ======================================================================

// Importações necessárias para o logout
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * Função principal que ativa todo o menu lateral.
 * É exportada para ser chamada pelo index.html (ou qualquer outra página ).
 */
export function ativarMenuLateral() {
    // 1. Marca o link ativo baseado na URL atual
    marcarLinkAtivo();

    // 2. ✅ CORREÇÃO DEFINITIVA: Configura o botão de logout.
    // Como esta função só é chamada DEPOIS que o menu está no DOM,
    // o botão 'btn-logout' com certeza será encontrado.
    configurarBotaoLogout();
}

/**
 * Marca o link da página atual como 'ativo' no menu.
 */
function marcarLinkAtivo() {
    const urlAtual = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === urlAtual) {
            link.classList.add('active');
        }
    });
}

/**
 * Encontra o botão de logout e adiciona o evento de clique a ele.
 * Esta é a solução para o botão que "parou de funcionar".
 */
function configurarBotaoLogout() {
    const btnLogout = document.getElementById("btn-logout");
    if (!btnLogout) {
        console.error("Botão de logout não encontrado no DOM. Verifique o menu-lateral.html.");
        return;
    }

    // Para evitar múltiplos eventos em navegações de SPA, removemos o antigo e o recriamos.
    const btnClone = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(btnClone, btnLogout);

    btnClone.addEventListener("click", async () => {
        try {
            console.log("Tentando fazer logout...");
            await signOut(auth);       // Desloga do Firebase
            localStorage.clear();      // Limpa TODA a sessão local (mais seguro)
            window.location.href = "login.html"; // Redireciona para o login
        } catch (err) {
            console.error("❌ Erro ao fazer logout:", err);
            alert("Não foi possível sair. Tente novamente.");
        }
    });
}

// ======================================================================
// A CHAMADA DIRETA FOI REMOVIDA DAQUI.
// A responsabilidade de chamar 'ativarMenuLateral' agora é da página
// que carrega o menu (ex: index.html), garantindo o timing correto.
// ======================================================================
