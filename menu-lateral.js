// auth-guard.js - VERSÃO FINAL E UNIFICADA

// 1. IMPORTAMOS A FUNÇÃO 'verificarAcesso' QUE JÁ ESTÁ FUNCIONANDO CORRETAMENTE
import { verificarAcesso } from "./userService.js";
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";


/**
 * Altera a visibilidade dos elementos do menu com base no papel (role) do usuário.
 * Esta função é chamada após a verificação de acesso.
 */
function updateMenuVisibility(role) {
  console.log(`[auth-guard.js] Atualizando a visibilidade do MENU para o papel: ${role}`);

  // Mostra os menus básicos que todos os usuários logados veem
  document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');

  // Lógica para mostrar menus restritos com base no papel
  switch (role?.toLowerCase()) {
    case 'admin':
      // O admin vê os menus específicos de admin
      document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
      // A lógica continua para o case 'dono' para que o admin também veja tudo que o dono vê.
      // (Não adicione 'break' aqui)

    case 'dono':
      // O dono (e o admin) veem os menus de dono
      document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
      break;

    case 'funcionario':
    default:
      // Nenhuma ação extra é necessária para o perfil de funcionário
      break;
  }
}

/**
 * Configura funcionalidades da página que dependem de autenticação, como o botão de logout.
 */
function setupPageFeatures() {
    const btnLogout = document.getElementById("btn-logout");
    // Garante que o evento de clique só seja adicionado uma vez
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener("click", () => {
            signOut(auth).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            });
        });
    }

    // Lógica para destacar o link ativo no menu
    const links = document.querySelectorAll(".sidebar-links a");
    const currentPage = window.location.pathname.split("/").pop().split("?")[0] || "index.html";
    links.forEach(link => {
        if(link) {
            const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];
            link.classList.toggle('active', linkPage === currentPage);
        }
    });
}


/**
 * Ponto de entrada do guardião.
 * Ele agora usa a mesma função 'verificarAcesso' da index.html para garantir consistência.
 */
async function initializeAuthGuard() {
    try {
        // 2. USAMOS A FONTE ÚNICA DA VERDADE PARA OBTER A SESSÃO E O PERFIL
        const userSession = await verificarAcesso();

        // Se a verificação for bem-sucedida e tivermos um perfil
        if (userSession && userSession.perfil) {
            // 3. PEGAMOS O PAPEL (role) DO LUGAR CERTO E ATUALIZAMOS O MENU
            const papel = userSession.perfil.papel; // 'dono', 'funcionario', etc.
            updateMenuVisibility(papel);
        } else {
            // Se não houver sessão, mostra apenas o básico (caso de página de login, etc)
            updateMenuVisibility(null);
        }
    } catch (error) {
        // Se verificarAcesso() der um erro (ex: redirecionamento), ele será tratado lá.
        // Apenas logamos o erro aqui se não for um erro de redirecionamento conhecido.
        if (!error.message.includes("Redirecionando")) {
            console.error("[auth-guard.js] Erro ao inicializar:", error);
        }
        // Garante que uma visão limitada seja mostrada em caso de erro.
        updateMenuVisibility(null);
    } finally {
        // Funções como o botão de logout devem ser configuradas independentemente do papel do usuário.
        setupPageFeatures();
    }
}

// Inicia o processo de verificação assim que o script é carregado.
initializeAuthGuard();
