// ======================================================================
// MENU-LATERAL.JS - Versão Final e Autônoma + Permissões Globais
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/**
 * Função principal que ativa todo o menu lateral.
 * É exportada para ser chamada pela página que o carrega (ex: index.html).
 * Recebe obrigatoriamente o papel do usuário logado ('admin', 'dono', 'funcionario') 
 * ou um array de papéis.
 */
export async function ativarMenuLateral(papelUsuario) {
    await aplicarPermissoesMenuLateral(papelUsuario);
    marcarLinkAtivo();
    configurarBotaoLogout(); // Garante que o logout sempre funcione.
}

/**
 * Função auxiliar para checar permissão para 1 ou mais papéis.
 */
function temPermissao(menus, id, papelUsuario) {
    if (!menus[id]) return false;
    if (Array.isArray(papelUsuario)) {
        return papelUsuario.some(papel => menus[id][papel] === true);
    } else {
        return menus[id][papelUsuario] === true;
    }
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
            const podeVer = temPermissao(menus, id, papelUsuario);
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
// ======================================================================
// ARQUIVO: menu-lateral.js
// FUNÇÃO: Controla o menu lateral, permissões de acesso e logout.
// ======================================================================

// --- 1. Importações Essenciais ---
// Importa as configurações e ferramentas necessárias do Firebase.
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
 * @param {string|string[]} papelUsuario - O papel (ou papéis) do usuário.
 * @returns {boolean} - Retorna true se o usuário tiver permissão, senão false.
 */
function temPermissao(menus, id, papelUsuario) {
    // Se não existir uma regra para este menu, bloqueia por segurança.
    if (!menus[id]) return false;

    // Se o usuário tiver múltiplos papéis (ex: admin e dono),
    // a função '.some()' retorna true se PELO MENOS UM dos papéis tiver permissão.
    if (Array.isArray(papelUsuario)) {
        return papelUsuario.some(papel => menus[id][papel] === true);
    } else {
        // Se for apenas um papel, a verificação é direta.
        return menus[id][papelUsuario] === true;
    }
}

/**
 * Busca as regras no Firestore e aplica a visibilidade (mostra/esconde) nos links do menu.
 * @param {string|string[]} papelUsuario - O papel (ou papéis) do usuário.
 */
async function aplicarPermissoesMenuLateral(papelUsuario) {
    // Validação crucial para evitar erros. Se o papel não for informado, a função para.
    if (!papelUsuario || papelUsuario.length === 0) {
        console.error("Papel do usuário não informado para aplicarPermissoesMenuLateral. O menu não será exibido corretamente.");
        return;
    }

    try {
        // Define o caminho para o documento de permissões no Firestore.
        const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
        // Busca o documento.
        const permissoesSnap = await getDoc(permissoesRef);
        // Se o documento existir, pega os dados. Senão, usa um objeto vazio.
        const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
        const menus = regras.menus || {}; // Pega a seção 'menus' dentro das regras.

        // Seleciona todos os elementos do menu que têm o atributo 'data-menu-id'.
        document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
            const id = link.dataset.menuId;
            // Verifica a permissão para o link atual.
            const podeVer = temPermissao(menus, id, papelUsuario);
            // Altera o CSS: se não pode ver, o link fica escondido (display: none).
            link.style.display = podeVer ? "" : "none";
        });

    } catch (error) {
        console.error("Erro crítico ao buscar ou aplicar permissões no menu lateral:", error);
    }
}

// --- 4. Funções de Interface do Usuário (UI) ---
/**
 * Destaca o link do menu correspondente à página que o usuário está visitando.
 */
function marcarLinkAtivo() {
    // Pega o nome do arquivo da URL atual (ex: 'dashboard.html').
    const urlAtual = window.location.pathname.split('/').pop() || 'index.html';
    // Seleciona todos os links do menu.
    document.querySelectorAll('.sidebar-links a').forEach(link => {
        // Remove a classe 'active' de todos os links para limpar o estado anterior.
        link.classList.remove('active');
        const linkHref = link.getAttribute('href').split('/').pop();
        // Se o link aponta para a página atual, adiciona a classe 'active'.
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

    // TÉCNICA AVANÇADA: Clonar o botão remove quaisquer 'event listeners' (eventos de clique)
    // que possam ter sido adicionados anteriormente. Isso evita bugs onde o botão para de
    // funcionar ou executa a ação de logout múltiplas vezes.
    const btnClone = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(btnClone, btnLogout);

    // Adiciona o evento de clique apenas ao botão "limpo".
    btnClone.addEventListener("click", async () => {
        try {
            await signOut(auth); // Faz o logout no Firebase.
            localStorage.clear(); // Limpa todos os dados da sessão (mais seguro).
            window.location.href = "login.html"; // Redireciona o usuário para a página de login.
        } catch (err) {
            console.error("❌ Erro ao tentar fazer logout:", err);
            alert("Não foi possível sair. Por favor, tente novamente.");
        }
    });
}
