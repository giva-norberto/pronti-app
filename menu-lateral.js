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

// === UIDs para dono (fallback manual, se quiser fixar alguns donos) ===
const DONO_UIDS = [
  // Exemplo: "WjH6nkGMnoRu0E7ALBVsSqptA9H2"
];

// === Função para determinar o perfil do usuário ===
function getUserRole(user) {
    // 1) Se já foi salvo no localStorage (via userService, login, etc.)
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) return storedRole;

    // 2) Se foi salvo no localStorage a flag ehDono (por exemplo: ao buscar Firestore)
    const ehDono = localStorage.getItem("ehDono");
    if (ehDono === "true") return "dono";

    // 3) Dono explícito pela lista manual
    if (user && user.uid && DONO_UIDS.includes(user.uid)) return "dono";

    // 4) Admin único pelo UID fixo
    if (user && user.uid === ADMIN_UID) return "admin";

    // 5) Padrão → funcionário
    return "funcionario";
}

// === Configura menus e botões conforme o papel do usuário ===
function setupAuthenticatedFeatures(user) {
    const userRole = getUserRole(user);

    // -------- Lógica para mostrar/ocultar menus conforme o perfil -----------
    // Use classes CSS: menu-func, menu-admin, menu-dono nos <a> do menu lateral!
    if (userRole === "funcionario") {
        document.querySelectorAll(".menu-func").forEach(e => e.style.display = "");
        document.querySelectorAll(".menu-admin, .menu-dono").forEach(e => e.style.display = "none");
    } else if (userRole === "admin") {
        document.querySelectorAll(".menu-admin").forEach(e => e.style.display = "");
        document.querySelectorAll(".menu-func").forEach(e => e.style.display = "");
        document.querySelectorAll(".menu-dono").forEach(e => e.style.display = "none");
    } else if (userRole === "dono") {
        document.querySelectorAll(".menu-admin, .menu-dono, .menu-func").forEach(e => e.style.display = "");
    }
    // ------------------------------------------------------------------------

    // Botão de logout
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        // Limpa listeners antigos para evitar múltiplos eventos de logout
        const newBtn = btnLogout.cloneNode(true);
        btnLogout.parentNode.replaceChild(newBtn, btnLogout);

        newBtn.addEventListener("click", () => {
            signOut(auth).then(() => {
                localStorage.removeItem("empresaAtivaId");
                localStorage.removeItem("userRole");
                localStorage.removeItem("ehDono");
                window.location.replace("login.html");
            });
        });
    }

    // Destaque do link ativo na sidebar
    const links = document.querySelectorAll(".sidebar-links a");
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    links.forEach(link => link.classList.remove("active"));
    links.forEach(link => {
        const linkPage = link.getAttribute("href").split("/").pop();
        if (linkPage === currentPage) {
            link.classList.add("active");
        }
    });

    // Exibir menu de administração somente para o admin
    const adminLink = document.getElementById("admin-link");
    if (adminLink) {
        if (user && user.uid === ADMIN_UID) {
            adminLink.style.display = "flex";
        } else {
            adminLink.style.display = "none";
        }
    }
}

// === Inicia a verificação de login do Firebase ===
function initializeAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith("login.html");
    const needsCompany = !isLoginPage && !window.location.pathname.endsWith("selecionar-empresa.html");
    const companyId = localStorage.getItem("empresaAtivaId");

    if (!user && !isLoginPage) {
      // Se não está logado e não está na página de login, redireciona.
      window.location.replace("login.html");
    } else if (user && needsCompany && !companyId) {
      // Se está logado mas não selecionou empresa, redireciona.
      window.location.replace("selecionar-empresa.html");
    } else if (user) {
      // Se está logado e tudo certo, configura as funcionalidades autenticadas.
      setupAuthenticatedFeatures(user);
    }
  });
}

// === Garante persistência e inicia o guardião ===
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    initializeAuthGuard();
  })
  .catch((error) => {
    console.error("Guardião do Menu: Falha ao ativar persistência!", error);
    initializeAuthGuard(); // Tenta iniciar mesmo se a persistência falhar
  });
