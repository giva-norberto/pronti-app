/**
 * @file menu-lateral.js
 * @description Módulo de ferramentas para controlar a visibilidade e as
 * funcionalidades do menu lateral da aplicação Pronti.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final - 09 de Setembro, 2025
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * Altera a visibilidade dos links do menu com base no papel (role) do usuário.
 * A função primeiro esconde todos os links e depois exibe apenas os permitidos.
 * @param {string} role O papel do usuário (ex: 'admin', 'dono', 'funcionario').
 */
export function updateMenuVisibility(role) {
  console.log(`[menu-lateral.js] Atualizando visibilidade do MENU para o papel: ${role}`);

  // 1. Esconde todos os links para garantir um estado inicial limpo.
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
 * Configura as funcionalidades interativas do menu, como o botão de logout
 * e o destaque do link da página ativa.
 */
export function setupMenuFeatures() {
  // --- Configuração do Botão de Logout ---
  const btnLogout = document.getElementById("btn-logout");
  // Garante que o evento de clique só seja adicionado uma vez
  if (btnLogout && !btnLogout.dataset.listenerAttached) {
    btnLogout.dataset.listenerAttached = 'true';
    btnLogout.addEventListener("click", () => {
      signOut(auth).then(() => {
        localStorage.clear();
        window.location.href = "login.html";
      }).catch(error => {
        console.error("Erro ao fazer logout:", error);
      });
    });
  }

  // --- Lógica para Destacar o Link Ativo ---
  try {
    const currentPagePath = window.location.pathname;
    const links = document.querySelectorAll('#sidebar-links a');

    links.forEach(function(link) {
      // new URL(link.href) garante que estamos comparando caminhos de forma segura
      const linkPath = new URL(link.href).pathname;
      if (currentPagePath === linkPath) {
        link.classList.add('active');
      }
    });
  } catch (e) {
    console.error("Erro ao tentar destacar o link ativo:", e);
  }
}
