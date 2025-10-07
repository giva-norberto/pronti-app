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
 * Inicializa o menu lateral.
 * @param {string|string[]} papelUsuario - Papel do usuário logado ('dono', 'admin', etc).
 */
export async function ativarMenuLateral(papelUsuario) {
    await aplicarPermissoesMenuLateral(papelUsuario); // Aplica regras de permissões do Firestore
    marcarLinkAtivo();                                // Destaca o link da página atual
    configurarBotaoLogout();                          // Configura botão de logout
}

// --- 3. Lógica de Permissões ---
/**
 * Checa se o usuário tem permissão para ver um item do menu.
 * @param {object} menus - Regras de permissão do Firestore.
 * @param {string} id - O 'data-menu-id' do link.
 * @param {string|string[]} papelUsuario - Papel do usuário.
 * @returns {boolean}
 */
function temPermissao(menus, id, papelUsuario) {
    // Se não existir uma regra para este menu, bloqueia por segurança.
    if (!menus[id]) return false;
    // Para múltiplos papéis, autoriza se ao menos um tiver permissão
    if (Array.isArray(papelUsuario)) {
        return papelUsuario.some(papel => menus[id][papel] === true);
    }
    // Para único papel
    return menus[id][papelUsuario] === true;
}

/**
 * Busca regras no Firestore e aplica visibilidade nos links do menu.
 * @param {string|string[]} papelUsuario
 */
async function aplicarPermissoesMenuLateral(papelUsuario) {
    // Validação para evitar erros. Aceita string ou array com itens.
    if (!papelUsuario || (Array.isArray(papelUsuario) && papelUsuario.length === 0) || (typeof papelUsuario === "string" && papelUsuario.trim() === "")) {
        console.error("Papel do usuário não informado para aplicarPermissoesMenuLateral. O menu não será exibido corretamente.");
        return;
    }
    try {
        const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
        const permissoesSnap = await getDoc(permissoesRef);
        const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
        const menus = regras.menus || {};

        // DEBUG: log de permissões e papel
        console.log("[DEBUG] Permissões menus:", menus);
        console.log("[DEBUG] Papel usuário:", papelUsuario);

        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            const id = link.dataset.menuId;
            const podeVer = temPermissao(menus, id, papelUsuario);
            // DEBUG: cada item do menu
            console.log(`[DEBUG] Menu: ${id}, Permissão:`, menus[id], "Papel:", papelUsuario, "Pode ver?", podeVer);
            link.style.display = podeVer ? "" : "none";
        });
    } catch (error) {
        console.error("Erro crítico ao buscar ou aplicar permissões no menu lateral:", error);
    }
}

// --- 4. Funções de Interface do Usuário (UI) ---
/**
 * Destaca o link do menu da página atual.
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
 * Configura o botão de logout.
 */
function configurarBotaoLogout() {
    const btnLogout = document.getElementById("btn-logout");
    if (!btnLogout) {
        console.error("Botão de logout com id='btn-logout' não foi encontrado no HTML.");
        return;
    }
    // Remove event listeners antigos e adiciona o novo
    const btnClone = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(btnClone, btnLogout);
    btnClone.addEventListener("click", async () => {
        try {
            await signOut(auth);
            localStorage.clear();
            sessionStorage?.clear?.();
            window.location.href = "login.html";
        } catch (err) {
            console.error("❌ Erro ao tentar fazer logout:", err);
            alert("Não foi possível sair. Por favor, tente novamente.");
        }
    });
}
