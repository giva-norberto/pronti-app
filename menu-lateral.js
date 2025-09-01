import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

setPersistence(auth, browserLocalPersistence)
    .then(() => {
        iniciarGuardiao();
    })
    .catch((error) => {
        console.error("Guardião do Menu: Falha ao ativar persistência!", error);
        iniciarGuardiao();
    });

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

function setupMenu() {
    const links = document.querySelectorAll('.sidebar-links a');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Marca link ativo
    links.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });

    // Setup logout button
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

    // Setup mobile menu
    setupMobileMenu();
}

function setupMobileMenu() {
    const hamburger = document.getElementById('sidebar-hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const links = document.querySelectorAll('.sidebar-links a');

    if (!hamburger || !sidebar) return;

    // Toggle menu
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Fecha menu ao clicar no overlay
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeMenu();
        });
    }

    // Fecha menu ao clicar fora
    document.addEventListener('click', (evt) => {
        if (window.innerWidth <= 768) {
            if (
                sidebar.classList.contains('show') &&
                !sidebar.contains(evt.target) &&
                !hamburger.contains(evt.target)
            ) {
                closeMenu();
            }
        }
    });

    // Fecha menu ao clicar em qualquer link
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
            hamburger.focus(); // Retorna foco para o botão
        }
    });

    // Fecha menu ao redimensionar para desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });

    // Navegação por teclado no menu
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
        hamburger.classList.add('active');
        document.body.classList.add('menu-open');
        if (overlay) overlay.classList.add('show');

        // Foco no primeiro link para acessibilidade
        const firstLink = sidebar.querySelector('.sidebar-links a');
        if (firstLink) {
            setTimeout(() => firstLink.focus(), 100);
        }

        // Atualiza aria-label
        hamburger.setAttribute('aria-label', 'Fechar menu');
    }

    function closeMenu() {
        sidebar.classList.remove('show');
        hamburger.classList.remove('active');
        document.body.classList.remove('menu-open');
        if (overlay) overlay.classList.remove('show');

        // Atualiza aria-label
        hamburger.setAttribute('aria-label', 'Abrir menu');
    }

    // Inicializa estado do menu baseado no tamanho da tela
    function initializeMenuState() {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    }

    // Chama na inicialização
    initializeMenuState();
}

// Previne flash de conteúdo não estilizado
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.visibility = 'visible';
});
