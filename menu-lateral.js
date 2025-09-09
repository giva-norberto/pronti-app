// =================================================================
//          ARQUIVO CENTRAL DO GUARDIÃO (menu-guardiao.js)
// =================================================================

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// === UID do administrador global ===
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// === Função para determinar o perfil do usuário (dinâmico do Firestore ) ===
async function getUserRole(user) {
  if (!user) return "funcionario";
  if (user.uid === ADMIN_UID) return "admin";

  try {
    const empresaId = localStorage.getItem("empresaAtivaId");
    if (!empresaId) return "funcionario";

    const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
    const profSnap = await getDoc(profRef);

    if (profSnap.exists() && profSnap.data().ehDono) {
      return "dono";
    }
  } catch (err) {
    console.error("[menu-guardiao] Erro ao buscar perfil:", err);
  }

  return "funcionario";
}

// Função que configura funcionalidades que dependem do usuário estar logado.
async function setupAuthenticatedFeatures(user) {
  const sidebar = document.getElementById('sidebar');
  
  try {
    const userRole = await getUserRole(user);

    // -------- Lógica para mostrar/ocultar menus conforme o perfil -----------
    // Função auxiliar para mostrar elementos de forma segura
    const showElements = (selector) => {
      document.querySelectorAll(selector).forEach(e => {
        if (e) e.style.display = "flex";
      });
    };
    
    // Esconde todos os menus por padrão para evitar sobreposição
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin').forEach(e => {
        if(e) e.style.display = "none";
    });

    // Mostra os menus com base no perfil, mantendo sua lógica original
    if (userRole === "funcionario") {
      showElements(".menu-func");
    } else if (userRole === "admin") {
      showElements(".menu-func, .menu-admin");
    } else if (userRole === "dono") {
      // Sua lógica original para dono (mostra tudo)
      showElements(".menu-func, .menu-dono, .menu-admin");
    }
    // ------------------------------------------------------------------------------

    // Lógica do botão de logout
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      const newBtn = btnLogout.cloneNode(true);
      if (btnLogout.parentNode) {
        btnLogout.parentNode.replaceChild(newBtn, btnLogout);
        newBtn.addEventListener("click", () => {
          signOut(auth).then(() => {
            localStorage.removeItem("empresaAtivaId");
            window.location.replace("login.html");
          });
        });
      }
    }

    // Lógica para destacar o link ativo na sidebar
    const links = document.querySelectorAll(".sidebar-links a");
    const currentPage = window.location.pathname.split("/").pop().split("?")[0] || "index.html";

    links.forEach(link => link.classList.remove("active"));
    links.forEach(link => {
      if (link) {
        const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];
        if (linkPage === currentPage) {
          link.classList.add("active");
        }
      }
    });

  } catch (error) {
    console.error("Erro ao configurar funcionalidades autenticadas:", error);
  } finally {
    // ESSA É A LINHA MAIS IMPORTANTE:
    // Garante que o menu sempre será exibido, mesmo se ocorrer um erro.
    if (sidebar) {
      sidebar.classList.remove('sidebar-loading');
    }
  }
}

// Inicia a verificação de login do Firebase
function initializeAuthGuard() {
  const sidebar = document.getElementById('sidebar');

  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith("login.html");
    const needsCompany = !isLoginPage && !window.location.pathname.endsWith("selecionar-empresa.html");
    const companyId = localStorage.getItem("empresaAtivaId");

    if (!user && !isLoginPage) {
      window.location.replace("login.html");
    } else if (user && needsCompany && !companyId) {
      window.location.replace("selecionar-empresa.html");
    } else if (user) {
      setupAuthenticatedFeatures(user);
    } else {
      // Se não há usuário e estamos na página de login/seleção, remove o loading
      if (sidebar) {
        sidebar.classList.remove('sidebar-loading');
      }
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
    // Inicia mesmo assim, mas remove o loading para a página não ficar em branco
    const sidebar = document.getElementById('sidebar');
    if(sidebar) sidebar.classList.remove('sidebar-loading');
    initializeAuthGuard();
  });
