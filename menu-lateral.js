// ======================================================================
// MENU-LATERAL.JS - Versão Final e Autônoma + Permissões Globais
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/**
 * Função principal que ativa todo o menu lateral.
 * É exportada para ser chamada pela página que o carrega (ex: index.html).
 * Recebe obrigatoriamente o papel do usuário logado ('admin', 'dono', 'funcionario').
 */
export async function ativarMenuLateral(papelUsuario) {
    await aplicarPermissoesMenuLateral(papelUsuario);
    marcarLinkAtivo();
    configurarBotaoLogout(); // Garante que o logout sempre funcione.
}

/**
 * Aplica as permissões globais do Firestore ao menu lateral.
 * Esconde automaticamente todos os itens do menu para os quais o papel não tem permissão.
 */
async function aplicarPermissoesMenuLateral(papelUsuario) {
    if (!papelUsuario) {
        console.error("Papel do usuário não informado para aplicarPermissoesMenuLateral");
        return;
    }
    try {
        const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
        const permissoesSnap = await getDoc(permissoesRef);
        const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
        const menus = regras.menus || {};
        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            const id = link.dataset.menuId;
            const regra = menus[id];
            const podeVer = regra && regra[papelUsuario] === true;
            link.style.display = podeVer ? "" : "none";
        });
    } catch (error) {
        console.error("Erro ao aplicar permissões no menu lateral:", error);
    }
}

/**
 * Marca o link da página atual como 'ativo' no menu.
 */
function marcarLinkAtivo() {
    const urlAtual = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        link.classList.remove('active');
        const linkHref = link.getAttribute('href').split('/').pop();
        if (linkHref === urlAtual) {
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
