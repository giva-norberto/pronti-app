/**
 * @file menu-lateral.js
 * @description Componente "Vigia" autônomo. Ele observa o DOM esperando o HTML do menu 
 * ser injetado por qualquer script e, então, aplica a lógica de permissões e funcionalidades.
 * @author Giva-Norberto & Gemini Assistant
 * @version 3.0.0 - Arquitetura de Observador
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from "./userService.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// ======================================================================
//      AS FERRAMENTAS (Lógica de UI, sem alterações)
// ======================================================================

function updateMenuVisibility(role) {
  console.log(`[menu-lateral.js] Visibilidade ativada para o papel: ${role}`);
  // Lógica "esconde primeiro, mostra depois" para garantir o estado correto
  document.querySelectorAll('.menu-dono, .menu-admin').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');
  
  switch (role?.toLowerCase()) {
    case 'admin':
      document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
    case 'dono':
      document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
      break;
  }
}

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
    links.forEach(function(link) {
      const linkPath = new URL(link.href).pathname;
      link.classList.remove('active');
      if (currentPagePath === linkPath) {
        link.classList.add('active');
      }
    });
  } catch (e) {
    console.error("Erro ao destacar link ativo:", e);
  }
}

// ======================================================================
//      O "VIGIA" (Lógica principal que executa tudo)
// ======================================================================

/**
 * A função principal que executa a lógica de permissões.
 * Ela será chamada pelo observador quando o menu for detectado.
 */
async function aplicarLogicaAoMenu() {
    try {
        const userSession = await verificarAcesso();
        let papel = 'funcionario'; // Assume o papel mais baixo por padrão

        if (userSession?.perfil && userSession?.user) {
            const { perfil, user } = userSession;
            if (user.uid === ADMIN_UID) {
                papel = 'admin';
            } else if (perfil.ehDono === true) {
                papel = 'dono';
            }
        }

        updateMenuVisibility(papel);
        setupMenuFeatures();

    } catch (error) {
        if (!error.message.includes("Redirecionando")) {
            console.error("[menu-lateral.js] Erro ao aplicar lógica:", error);
        }
    }
}

/**
 * Observador que fica "vigiando" a página por mudanças.
 */
const observer = new MutationObserver((mutationsList, obs) => {
    // Procura pelo menu (#sidebar)
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        console.log('[menu-lateral.js] Menu detectado na página. Aplicando lógica...');
        aplicarLogicaAoMenu();
        // Uma vez que o menu foi encontrado e configurado, o vigia pode parar de trabalhar.
        obs.disconnect(); 
    }
});

// Inicia o "Vigia" para observar o corpo da página e seus filhos.
observer.observe(document.body, {
    childList: true,
    subtree: true
});
