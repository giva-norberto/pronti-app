// =================================================================
//          ARQUIVO CENTRAL DO GUARDIÃO (menu-guardiao.js)
// =================================================================

import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// A PARTE DE CONTROLE DO HAMBÚRGUER FOI REMOVIDA DAQUI.
// Este arquivo agora foca 100% na autenticação e segurança.

// Função que configura funcionalidades que dependem do usuário estar logado.
function setupAuthenticatedFeatures( ) {
    // Lógica do botão de logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        // Limpa listeners antigos para evitar múltiplos eventos de logout
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
    
    // Remove a classe 'active' de todos os links primeiro
    links.forEach(link => link.classList.remove('active'));

    // Adiciona a classe 'active' apenas ao link correto
    links.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}

// Inicia a verificação de login do Firebase
function initializeAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const needsCompany = !isLoginPage && !window.location.pathname.endsWith('selecionar-empresa.html');
    const companyId = localStorage.getItem("empresaAtivaId");

    if (!user && !isLoginPage) {
      // Se não está logado e não está na página de login, redireciona.
      window.location.replace('login.html');
    } else if (user && needsCompany && !companyId) {
      // Se está logado mas não selecionou empresa, redireciona.
      window.location.replace('selecionar-empresa.html');
    } else if (user) {
      // Se está logado e tudo certo, configura as funcionalidades autenticadas.
      setupAuthenticatedFeatures();
    }
  });
}

// Garante persistência e inicia o guardião
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    initializeAuthGuard();
  })
  .catch((error) => {
    console.error("Guardião do Menu: Falha ao ativar persistência!", error);
    initializeAuthGuard(); // Tenta iniciar mesmo se a persistência falhar
  });
