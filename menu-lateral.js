// VERSÃO FINAL CORRIGIDA - 09 DE SETEMBRO, 22:16

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * EXPORTADA: Altera a visibilidade dos elementos do menu com base no papel.
 * @param {string} role - O papel do usuário (ex: 'dono', 'funcionario').
 */
export function updateMenuVisibility(role) {
  console.log(`[menu-lateral.js] Atualizando visibilidade do MENU para o papel: ${role}`);

  // ======================================================================
  // ⭐ LÓGICA DE VISIBILIDADE CORRIGIDA E MAIS SEGURA
  // ======================================================================

  // 1. Primeiro, esconde TODOS os links para garantir um estado inicial limpo.
  const allLinks = document.querySelectorAll('#sidebar-links a');
  allLinks.forEach(link => link.style.display = 'none');
  
  // 2. Mostra os links básicos que TODOS os usuários logados devem ver.
  document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');

  // 3. Verifica o papel e mostra os links extras, se o usuário tiver permissão.
  switch (role?.toLowerCase()) {
    case 'admin':
      // Se for admin, mostra os links de admin.
      document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
      // A lógica continua para o case 'dono' para que o admin também veja tudo que o dono vê.
    
    case 'dono':
      // Se for dono (ou admin), mostra os links de dono.
      document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
      break;

    case 'funcionario':
    default:
      // Se for funcionário, não faz mais nada. Ele verá apenas os links '.menu-func'.
      break;
  }
}

/**
 * EXPORTADA: Configura funcionalidades do menu, como o botão de logout e links ativos.
 */
export function setupMenuFeatures() {
  // Configura o botão de logout.
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout && !btnLogout.dataset.listenerAttached) {
    btnLogout.dataset.listenerAttached = 'true';
    btnLogout.addEventListener("click", () => {
      signOut(auth).then(() => {
        localStorage.clear();
        window.location.href = "login.html";
      });
    });
  }

  // Lógica para destacar o link ativo.
  try {
    const currentPagePath = window.location.pathname;
    const links = document.querySelectorAll('#sidebar-links a');

    links.forEach(function(link) {
      const linkPath = new URL(link.href).pathname;
      if (currentPagePath === linkPath) {
        link.classList.add('active');
      }
    });
  } catch (e) {
    console.error("Erro ao destacar link ativo:", e);
  }
}
