/**
 * @file menu-lateral.js
 * @description Componente autônomo e inteligente para o menu lateral da aplicação Pronti.
 * Gerencia seu próprio carregamento, permissões e funcionalidades.
 * @author Giva-Norberto & Gemini Assistant
 * @version 2.0.0 - Arquitetura de Componente Autônomo
 */

// 1. IMPORTA AS FERRAMENTAS NECESSÁRIAS
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// Agora ele mesmo chama o userService para descobrir o papel do usuário
import { verificarAcesso } from "./userService.js";

// A constante para identificar o Admin vive aqui, pois o menu controla o acesso de admin
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

/**
 * Altera a visibilidade dos links do menu com base no papel (role) do usuário.
 * Esta é a sua lógica de permissão, mantida e corrigida.
 * @param {string} role O papel do usuário (ex: 'admin', 'dono', 'funcionario').
 */
function updateMenuVisibility(role) {
  console.log(`[menu-lateral.js] Atualizando visibilidade do MENU para o papel: ${role}`);

  // Primeiro, esconde todos os links para garantir um estado limpo
  document.querySelectorAll('#sidebar-links a').forEach(link => link.style.display = 'none');
  
  // Mostra os links básicos que todos os usuários logados devem ver
  document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');

  // Mostra os links extras com base na permissão
  switch (role?.toLowerCase()) {
    case 'admin':
      document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
    case 'dono':
      document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
      break;
    default:
      // Nenhuma ação extra para funcionário
      break;
  }
}

/**
 * Configura as funcionalidades interativas do menu, como o botão de logout
 * e o destaque do link da página ativa.
 */
function setupMenuFeatures() {
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout && !btnLogout.dataset.listenerAttached) {
    btnLogout.dataset.listenerAttached = 'true';
    btnLogout.addEventListener("click", () => signOut(auth).then(() => {
      localStorage.clear();
      window.location.href = "login.html";
    }));
  }

  try {
    const currentPagePath = window.location.pathname;
    const links = document.querySelectorAll('#sidebar-links a');
    links.forEach(link => {
      const linkPath = new URL(link.href).pathname;
      if (currentPagePath === linkPath) link.classList.add('active');
    });
  } catch (e) { console.error("Erro ao destacar link ativo:", e); }
}

/**
 * Função principal auto-executável que inicializa o componente do menu.
 * Esta é a implementação da arquitetura final que você projetou.
 */
(async function inicializarMenu() {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    if (!sidebarPlaceholder) {
        console.error("Erro Crítico: O placeholder '<div id=\"sidebar-placeholder\"></div>' não foi encontrado na página.");
        return;
    }

    try {
        // 1. Busca seu próprio HTML
        const response = await fetch('menu-lateral.html');
        if (!response.ok) throw new Error('Falha ao carregar o template do menu.');
        const menuHtml = await response.text();
        sidebarPlaceholder.innerHTML = menuHtml;

        // 2. Busca os dados da sessão do usuário
        const userSession = await verificarAcesso();
        if (!userSession || !userSession.perfil) {
            setupMenuFeatures(); // Ativa o botão de logout mesmo sem sessão
            return;
        }

        const { perfil, user } = userSession;

        // 3. Determina o papel do usuário
        if (user.uid === ADMIN_UID) {
            perfil.papel = 'admin';
        } else if (perfil.ehDono === true) {
            perfil.papel = 'dono';
        } else {
            perfil.papel = 'funcionario';
        }

        // 4. Chama suas próprias funções para se auto-configurar
        updateMenuVisibility(perfil.papel);
        setupMenuFeatures();

    } catch (error) {
        if (!error.message.includes("Redirecionando")) {
            console.error("[menu-lateral.js] Erro na inicialização:", error);
            sidebarPlaceholder.innerHTML = "<p style='color:red;padding:1em;'>Erro ao carregar menu.</p>";
        }
    }
})();
