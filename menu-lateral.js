// ======================================================================
// ARQUIVO: menu-lateral.js
// FUNÇÃO: Controla o menu lateral, permissões de acesso e logout.
// ======================================================================

// --- 1. Importações Essenciais ---
import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- 2. Função Principal de Ativação ---
/**
 * Ponto de entrada principal para inicializar o menu.
 * Esta função é exportada para ser chamada por outras páginas (ex: dashboard.js).
 * @param {string|string[]} papelUsuario - O papel (ou papéis) do usuário logado. Ex: 'dono' ou ['dono', 'admin'].
 */
export async function ativarMenuLateral(papelUsuario) {
    // CORREÇÃO: Sempre converte para array (e nunca array vazio)
    if (typeof papelUsuario === "string") {
        papelUsuario = [papelUsuario];
    }
    if (!Array.isArray(papelUsuario)) {
        papelUsuario = [];
    }
    // Se o array está vazio, não faça nada e esconda todos os menus
    if (papelUsuario.length === 0) {
        console.error("Papel do usuário NÃO informado para aplicarPermissoesMenuLateral. O menu não será exibido corretamente.");
        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            link.style.display = "none";
        });
        return;
    }
    // Passo A: Aplica as regras de visibilidade dos links do menu.
    await aplicarPermissoesMenuLateral(papelUsuario);
    // Passo B: Destaca o link da página atual.
    marcarLinkAtivo();
    // Passo C: Garante que o botão de logout funcione corretamente.
    configurarBotaoLogout();
}

// --- 3. Lógica de Permissões ---
/**
 * Função auxiliar que verifica se o usuário tem permissão para ver um item de menu.
 * @param {object} menus - O objeto de regras de permissão vindo do Firestore.
 * @param {string} id - O 'data-menu-id' do link que estamos verificando.
 * @param {string[]} papelUsuario - O array de papéis do usuário.
 * @returns {boolean} - Retorna true se o usuário tiver permissão, senão false.
 */
function temPermissao(menus, id, papelUsuario) {
    if (!menus[id]) return false;
    return papelUsuario.some(papel => menus[id][papel] === true);
}

/**
 * Busca as regras no Firestore e aplica a visibilidade (mostra/esconde) nos links do menu.
 * @param {string[]} papelUsuario - O array de papéis do usuário.
 */
async function aplicarPermissoesMenuLateral(papelUsuario) {
    if (!Array.isArray(papelUsuario) || papelUsuario.length === 0) {
        console.error("Papel do usuário NÃO informado para aplicarPermissoesMenuLateral. O menu não será exibido corretamente.");
        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            link.style.display = "none";
        });
        return;
    }

    try {
        const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
        const permissoesSnap = await getDoc(permissoesRef);
        const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
        const menus = regras;

        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            const id = link.dataset.menuId;
            const podeVer = temPermissao(menus, id, papelUsuario);
            link.style.display = podeVer ? "" : "none";
        });

    } catch (error) {
        console.error("Erro crítico ao buscar ou aplicar permissões no menu lateral:", error);
        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            link.style.display = "none";
        });
    }
}

// --- 4. Funções de Interface do Usuário (UI) ---
/**
 * Destaca o link do menu correspondente à página que o usuário está visitando.
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
 * Configura o botão de logout para funcionar de forma segura e confiável.
 */
function configurarBotaoLogout() {
    const btnLogout = document.getElementById("btn-logout");
    if (!btnLogout) {
        console.error("Botão de logout com id='btn-logout' não foi encontrado no HTML.");
        return;
    }

    const btnClone = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(btnClone, btnLogout);

    btnClone.addEventListener("click", async () => {
        try {
            await signOut(auth);
            localStorage.clear();
            window.location.href = "login.html";
        } catch (err) {
            console.error("❌ Erro ao tentar fazer logout:", err);
            alert("Não foi possível sair. Por favor, tente novamente.");
        }
    });
}
