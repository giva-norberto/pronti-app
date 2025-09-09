// auth-guard.js - AGORA É UM MÓDULO DE FERRAMENTAS

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * EXPORTADA: Altera a visibilidade dos elementos do menu com base no papel.
 * @param {string} role - O papel do usuário (ex: 'dono', 'funcionario').
 */
export function updateMenuVisibility(role) {
  console.log(`[auth-guard.js] Atualizando visibilidade do MENU para o papel: ${role}`);

  // Mostra os menus básicos que todos veem.
  document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');

  // Mostra os menus restritos com base no papel.
  switch (role?.toLowerCase()) {
    case 'admin':
      document.querySelectorAll('.menu-admin').forEach(el => el.style.display = 'flex');
      // Continua para 'dono' para que admin veja tudo de dono.
    case 'dono':
      document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
      break;
    default:
      // Nenhuma ação extra para funcionário.
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
  const links = document.querySelectorAll(".sidebar-links a");
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  links.forEach(link => {
    const linkPage = link.getAttribute("href").split("/").pop();
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });
}
