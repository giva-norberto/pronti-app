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

// === UID do administrador ===
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// === Função para determinar o perfil do usuário ===
// Sugestão: Você pode adaptar para buscar do seu backend ou custom claims, se quiser.
// Aqui, exemplo simples usando localStorage (ajuste para seu caso real!)
function getUserRole(user) {
    // Exemplo: supondo que no localStorage você salva em 'userRole' após login
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) return storedRole;

    // Ou, se o admin é único pelo UID:
    if (user && user.uid === ADMIN_UID) return 'admin';

    // Se quiser, coloque lógica para dono aqui.
    // Exemplo: return 'dono' para UIDs específicos.

    // Padrão: funcionário
    return 'funcionario';
}

// Função que configura funcionalidades que dependem do usuário estar logado.
function setupAuthenticatedFeatures(user) {
    const userRole = getUserRole(user);

    // -------- NOVO: Lógica para mostrar/ocultar menus conforme o perfil -----------
    // Adote classes CSS: menu-func, menu-admin, menu-dono nos <a> do menu lateral!
    if (userRole === 'funcionario') {
        document.querySelectorAll('.menu-func').forEach(e => e.style.display = '');
        document.querySelectorAll('.menu-admin, .menu-dono').forEach(e => e.style.display = 'none');
    } else if (userRole === 'admin' || userRole === 'dono') {
        document.querySelectorAll('.menu-admin, .menu-dono').forEach(e => e.style.display = '');
        document.querySelectorAll('.menu-func').forEach(e => e.style.display = '');
    }
    // ------------------------------------------------------------------------------

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

    // Lógica para exibir o menu de administração somente para o admin
    const adminLink = document.getElementById('admin-link');
    if (adminLink) {
        if (user && user.uid === ADMIN_UID) {
            adminLink.style.display = 'flex';
        } else {
            adminLink.style.display = 'none';
        }
    }
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
      setupAuthenticatedFeatures(user);
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
