/**
 * @file menu-lateral.js
 * @description Gerencia o menu lateral, incluindo logout, link ativo e visibilidade dinâmica dos itens com base nas permissões globais do usuário.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final
 */

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { verificarAcesso } from "./userService.js";

// --- Configura o botão de logout e destaca o link da página ativa ---
function setupMenuFeatures() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener("click", () => {
            signOut(auth).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            }).catch(err => console.error("❌ Erro ao deslogar:", err));
        });
    }

    const currentPage = window.location.pathname;
    document.querySelectorAll('#sidebar-links a').forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        if (linkPath === currentPage) {
            link.closest('li')?.classList.add('active');
        }
    });
}

// --- ATUALIZADO: Atualiza a visibilidade dos menus com base nas permissões ---
async function updateMenuWithPermissions() {
    try {
        // 1. Pega os dados da sessão (usuário e seu papel)
        const sessao = await verificarAcesso();
        const papelUsuario = sessao.perfil.papel; // 'admin', 'dono', ou 'funcionario'

        // 2. Busca as regras de permissão globais do Firestore
        const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
        const permissoesSnap = await getDoc(permissoesRef);
        const regrasGlobais = permissoesSnap.exists() ? permissoesSnap.data() : {};

        // 3. Pega todos os itens de menu que devem ser controlados
        const menuItems = document.querySelectorAll('[data-menu-id]');
        
        // 4. Lógica principal: Itera sobre cada item e decide se deve exibi-lo
        menuItems.forEach(item => {
            const menuId = item.dataset.menuId; // Ex: 'agenda', 'clientes'
            const regraParaMenu = regrasGlobais[menuId];

            // Verifica se existe uma regra e se o papel do usuário tem permissão
            if (regraParaMenu && regraParaMenu[papelUsuario] === true) {
                item.style.display = 'flex'; // ou 'block', dependendo do seu CSS
            } else {
                item.style.display = 'none'; // Esconde o item se não houver permissão
            }
        });

    } catch (error) {
        console.error("❌ Erro ao aplicar permissões no menu:", error);
    }
}

// --- Inicialização do Menu ---
(async () => {
    try {
        // Primeiro, esconde todos os menus controláveis para evitar "piscar" na tela
        document.querySelectorAll('[data-menu-id]').forEach(el => el.style.display = 'none');
        
        await updateMenuWithPermissions(); // Aplica as permissões corretas
        setupMenuFeatures(); // Configura logout e link ativo
    } catch (err) {
        console.error("❌ Erro fatal inicializando menu lateral:", err);
        // A função verificarAcesso() dentro de updateMenu já redireciona se necessário
    }
})();
