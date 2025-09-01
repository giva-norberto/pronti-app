// =================================================================
//          ARQUIVO CENTRAL DO MENU (EX: menu-guardiao.js)
// =================================================================

import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";


// ---------------------------------------------------------------------------------
// PARTE 1: INICIALIZAÇÃO VISUAL IMEDIATA
// Este código roda assim que o DOM estiver pronto, sem esperar pelo Firebase.
// A única responsabilidade dele é fazer o botão de hambúrguer funcionar.
// ---------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('sidebar-hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!hamburgerBtn || !sidebar) {
    console.error("Componentes do menu (hambúrguer ou sidebar) não encontrados.");
    return;
  }

  const toggleMenu = () => {
    // Esta função simplesmente abre ou fecha o menu.
    const isOpen = sidebar.classList.contains('show');
    if (isOpen) {
      sidebar.classList.remove('show');
      hamburgerBtn.classList.remove('active');
      document.body.classList.remove('menu-open');
      if (overlay) overlay.classList.remove('show');
    } else {
      sidebar.classList.add('show');
      hamburgerBtn.classList.add('active');
      document.body.classList.add('menu-open');
      if (overlay) overlay.classList.add('show');
    }
  };

  // Adiciona o evento de clique que funciona imediatamente.
  hamburgerBtn.addEventListener('click', toggleMenu);

  // Adiciona o evento para fechar com o overlay.
  if (overlay) {
    overlay.addEventListener('click', () => {
        // Garante que só a função de fechar será chamada
        sidebar.classList.remove('show');
        hamburgerBtn.classList.remove('active');
        document.body.classList.remove('menu-open');
        overlay.classList.remove('show');
    });
  }
});


// ---------------------------------------------------------------------------------
// PARTE 2: LÓGICA DE AUTENTICAÇÃO E GUARDIÃO
// Esta parte continua a mesma, cuidando da segurança e das funcionalidades
// que REALMENTE dependem do usuário estar logado.
// ---------------------------------------------------------------------------------

// Função que configura coisas que SÓ acontecem DEPOIS do login ser confirmado
function setupAuthenticatedMenu() {
    // Lógica do botão de logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        // Limpa listeners antigos para segurança (opcional, mas bom)
        const newBtn = btnLogout.cloneNode(true);
        btnLogout.parentNode.replaceChild(newBtn, btnLogout);
        
        newBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                localStorage.removeItem("empresaAtivaId");
                window.location.replace('login.html');
            });
        });
    }

    // Lógica para destacar o link ativo na sidebar
    const links = document.querySelectorAll('.sidebar-links a');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    links.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}

// Inicia a verificação de login do Firebase
function iniciarGuardiao() {
  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const precisaEmpresa = !isLoginPage && !window.location.pathname.endsWith('selecionar-empresa.html');
    const empresaId = localStorage.getItem("empresaAtivaId");

    if (!user && !isLoginPage) {
      // Se não está logado e não está na página de login, redireciona.
      window.location.replace('login.html');
    } else if (user && precisaEmpresa && !empresaId) {
      // Se está logado mas não selecionou empresa, redireciona.
      window.location.replace('selecionar-empresa.html');
    } else if (user) {
      // Se está logado e tudo certo, configura a parte autenticada do menu.
      setupAuthenticatedMenu();
    }
  });
}

// Garante persistência e inicia o guardião (isso roda quando o script carrega)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    iniciarGuardiao();
  })
  .catch((error) => {
    console.error("Guardião do Menu: Falha ao ativar persistência!", error);
    iniciarGuardiao(); // Tenta iniciar mesmo se a persistência falhar
  });
