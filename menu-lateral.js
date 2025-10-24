// ======================================================================
// ARQUIVO: menu-lateral.js
// FUNÇÃO: Controla o menu lateral, permissões de acesso e logout.
// Observação: adicionei rotina (Opção B) para injetar botão "Voltar" no sidebar
// sem tocar templates; corrigi bug que podia travar o script.
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
    // Passo B.5: Injeta botão "Voltar" no sidebar (Opção B - injeção via JS, sem tocar templates).
    // Esta chamada não altera a lógica original do menu, apenas adiciona um botão de navegação se o sidebar existir.
    try {
        inserirBotaoVoltarNoSidebar();
    } catch (e) {
        // não interrompe fluxo original
        console.warn('[menu-lateral] não foi possível inserir botão Voltar no sidebar:', e);
    }
    // Passo C: Garante que o botão de logout funcione corretamente.
    configurarBotaoLogout();
}

/* ---------------------------------------------------------------------
   Funções adicionadas: inserirBotaoVoltarNoSidebar, updateVisibilidadeBotaoVoltar
   - Implementam a Opção B pedida (injeção via JS em um único arquivo).
   - Não mudam nenhuma lógica existente do menu/relatórios.
   --------------------------------------------------------------------- */

/**
 * Detecta se o app está em modo PWA/standalone (iOS/Android).
 * @returns {boolean}
 */
function isPWAInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || (window.navigator && window.navigator.standalone === true)
        || (document.referrer && document.referrer.startsWith('android-app://'));
}

/**
 * Insere um botão "Voltar" no sidebar (se existir). Não altera templates.
 * O botão usa history.back() quando houver histórico; caso contrário faz fallback para index.html.
 * Id do botão: #btn-global-back-sidebar
 */
function inserirBotaoVoltarNoSidebar() {
    const SIDEBAR_ID = 'sidebar';
    const BUTTON_ID = 'btn-global-back-sidebar';
    const HOME_URL = window.PRONTI_HOME_URL || '/index.html';

    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) {
        // nada a fazer se não houver sidebar
        return;
    }

    // Se já existe, apenas atualiza visibilidade
    let existing = document.getElementById(BUTTON_ID);
    if (existing) {
        updateVisibilidadeBotaoVoltar();
        return;
    }

    // Cria wrapper e botão (coloca logo abaixo do .sidebar-brand se existir)
    const wrapper = document.createElement('div');
    wrapper.className = 'sidebar-back-wrapper';
    wrapper.style.padding = '0 24px 12px 24px';

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'sidebar-back';
    btn.setAttribute('aria-label', 'Voltar');
    btn.innerHTML = '<i class="fa fa-arrow-left" aria-hidden="true"></i><span class="sidebar-back-text" style="margin-left:8px;">Voltar</span>';

    // Estilos inline mínimos para garantir aparência mesmo sem CSS adicional
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '8px';
    btn.style.width = '100%';
    btn.style.cursor = 'pointer';
    btn.style.borderRadius = '10px';
    btn.style.padding = '10px 12px';
    btn.style.fontWeight = '700';
    btn.style.background = 'rgba(255,255,255,0.12)';
    btn.style.color = '#fff';
    btn.style.border = '1px solid rgba(255,255,255,0.12)';

    wrapper.appendChild(btn);

    const brand = sidebar.querySelector('.sidebar-brand');
    if (brand && brand.parentNode) {
        brand.parentNode.insertBefore(wrapper, brand.nextSibling);
    } else {
        // insere no topo do sidebar se não achar .sidebar-brand
        sidebar.insertBefore(wrapper, sidebar.firstChild);
    }

    // Clique: tenta history.back() senão direciona para HOME_URL
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        try {
            if (window.history && window.history.length > 1) {
                history.back();
                return;
            }
        } catch (err) {
            console.warn('[menu-lateral] history.back falhou:', err);
        }
        window.location.href = HOME_URL;
    });

    // Observa mutações para garantir que o botão não seja removido inadvertidamente
    const mo = new MutationObserver((mutations) => {
        if (!document.getElementById(BUTTON_ID)) {
            // re-inserir se removido
            // desconecta observer temporariamente para evitar loop
            try { mo.disconnect(); } catch (e) { /* ignore */ }
            // tentar re-inserir com pequeno delay para evitar conflitos
            setTimeout(() => {
                try { inserirBotaoVoltarNoSidebar(); } catch (_) { /* ignore */ }
            }, 50);
        }
    });
    // start observer (keeps wrapper in DOM)
    try {
        mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
        // se falhar, não é crítico
    }

    // Atualiza visibilidade baseada em regras
    updateVisibilidadeBotaoVoltar();

    // Atualiza visibilidade em eventos relevantes
    window.addEventListener('popstate', updateVisibilidadeBotaoVoltar);
    window.addEventListener('hashchange', updateVisibilidadeBotaoVoltar);
    document.addEventListener('visibilitychange', updateVisibilidadeBotaoVoltar);
    window.addEventListener('resize', updateVisibilidadeBotaoVoltar);
}

/**
 * Atualiza a visibilidade do botão "Voltar" injetado.
 */
function updateVisibilidadeBotaoVoltar() {
    const BUTTON_ID = 'btn-global-back-sidebar';
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    const path = location.pathname || '/';
    const isHome = (path === '/' || path.endsWith('/index.html'));
    const hasHistory = (window.history && window.history.length > 1);
    // Mostrar se houver histórico, se for PWA instalado (user experience) ou se não for a home
    if (hasHistory || isPWAInstalled() || !isHome) {
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'flex-start';
    } else {
        btn.style.display = 'none';
    }
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
