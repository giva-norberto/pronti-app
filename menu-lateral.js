import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Garante persistência do login
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    iniciarGuardiao();
  })
  .catch((error) => {
    console.error("Guardião do Menu: Falha ao ativar persistência!", error);
    iniciarGuardiao();
  });

// Protege rotas: exige login e empresa ativa
function iniciarGuardiao() {
  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const precisaEmpresa = !isLoginPage && !window.location.pathname.endsWith('selecionar-empresa.html');
    const empresaId = localStorage.getItem("empresaAtivaId");

    if (!user && !isLoginPage) {
      window.location.replace('login.html');
    } else if (precisaEmpresa && !empresaId) {
      window.location.replace('selecionar-empresa.html');
    } else {
      setupMenu();
    }
  });
}

// Inicializa comportamentos e eventos do menu lateral
function setupMenu() {
  const links = document.querySelectorAll('.sidebar-links a');
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Destaca o link da página atual
  links.forEach(link => {
    const linkPage = link.getAttribute('href').split('/').pop();
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });

  // Botão de logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    const newBtn = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(newBtn, btnLogout);
    newBtn.addEventListener('click', () => {
      signOut(auth).then(() => {
        localStorage.removeItem("empresaAtivaId");
        window.location.replace('login.html');
      });
    });
  }

  // Menu responsivo (hambúrguer, overlay, etc)
  setupMobileMenu();
}

// Responsividade e interatividade mobile
function setupMobileMenu() {
  const hamburger = document.getElementById('sidebar-hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const links = document.querySelectorAll('.sidebar-links a');

  if (!hamburger || !sidebar) return;

  // Remove event listeners antigos (garante que só 1 vez)
  hamburger.replaceWith(hamburger.cloneNode(true));
  const newHamburger = document.getElementById('sidebar-hamburger');

  // Abre/fecha menu mobile ao clicar no ícone
  newHamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Fecha menu ao clicar no overlay
  if (overlay) {
    overlay.replaceWith(overlay.cloneNode(true));
    const newOverlay = document.getElementById('sidebar-overlay');
    newOverlay.addEventListener('click', () => {
      closeMenu();
    });
  }

  // Fecha menu ao clicar fora dele (mobile)
  document.addEventListener('click', (evt) => {
    if (window.innerWidth <= 768) {
      if (
        sidebar.classList.contains('show') &&
        !sidebar.contains(evt.target) &&
        !newHamburger.contains(evt.target)
      ) {
        closeMenu();
      }
    }
  });

  // Fecha menu ao clicar em qualquer link dele (mobile)
  links.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeMenu();
      }
    });
  });

  // Fecha menu com tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('show')) {
      closeMenu();
      newHamburger.focus(); // Retorna foco para o botão
    }
  });

  // Fecha menu ao voltar para desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });

  // Navegação por teclado nos links do menu mobile
  sidebar.addEventListener('keydown', (e) => {
    if (!sidebar.classList.contains('show')) return;

    const focusableElements = sidebar.querySelectorAll('a, button');
    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % focusableElements.length;
      focusableElements[nextIndex].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
      focusableElements[prevIndex].focus();
    }
  });

  // Funções auxiliares
  function toggleMenu() {
    const isOpen = sidebar.classList.contains('show');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    sidebar.classList.add('show');
    newHamburger.classList.add('active');
    document.body.classList.add('menu-open');
    if (overlay) document.getElementById('sidebar-overlay').classList.add('show');

    // Foco no primeiro link para acessibilidade
    const firstLink = sidebar.querySelector('.sidebar-links a');
    if (firstLink) {
      setTimeout(() => firstLink.focus(), 100);
    }

    // Atualiza aria-label
    newHamburger.setAttribute('aria-label', 'Fechar menu');
  }

  function closeMenu() {
    sidebar.classList.remove('show');
    newHamburger.classList.remove('active');
    document.body.classList.remove('menu-open');
    if (overlay) document.getElementById('sidebar-overlay').classList.remove('show');

    // Atualiza aria-label
    newHamburger.setAttribute('aria-label', 'Abrir menu');
  }

  // Garante estado correto ao abrir a página/redimensionar
  function initializeMenuState() {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  }

  initializeMenuState();
}

// Previne flash de conteúdo não estilizado
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.visibility = 'visible';
});
