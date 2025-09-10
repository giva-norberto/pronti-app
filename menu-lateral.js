/**
 * @file menu-lateral.js
 * @description Módulo de ferramentas ("toolbox") para controlar a visibilidade e as
 * funcionalidades do menu lateral da aplicação Pronti.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * Altera a visibilidade dos links do menu com base no papel (role) do usuário.
 * Esta função PRECISA ser exportada para que o page-loader.js possa usá-la.
 * @param {string} role O papel do usuário (ex: 'admin', 'dono', 'funcionario').
 */
export function updateMenuVisibility(role) {
  console.log(`[menu-lateral.js] Aplicando visibilidade para o papel: ${role}`);

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

/**
 * Configura as funcionalidades interativas do menu, como o botão de logout
 * e o destaque do link da página ativa.
 * Esta função PRECISA ser exportada para que o page-loader.js possa usá-la.
 */
export function setupMenuFeatures() {
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
