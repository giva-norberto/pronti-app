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

// === Função para determinar o perfil do usuário (dinâmico do Firestore) ===
async function getUserRole(user) {
  if (!user) return "funcionario";

  // Admin fixo
  if (user.uid === ADMIN_UID) return "admin";

  try {
    const empresaId = localStorage.getItem("empresaAtivaId");
    if (!empresaId) return "funcionario";

    // Documento do profissional dentro da empresa
    const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
    const profSnap = await getDoc(profRef);

    if (profSnap.exists()) {
      const dados = profSnap.data();
      if (dados.ehDono) return "dono";
    }
  } catch (err) {
    console.error("[menu-guardiao] Erro ao buscar perfil:", err);
  }

  return "funcionario";
}

// Função que configura funcionalidades que dependem do usuário estar logado.
async function setupAuthenticatedFeatures(user) {
  const userRole = await getUserRole(user);

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
  // ------------------------------------------------------------------------------

  // Lógica do botão de logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    const newBtn = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(newBtn, btnLogout);

    newBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        localStorage.removeItem("empresaAtivaId");
        window.location.replace("login.html");
      });
    });
  }

  // Lógica para destacar o link ativo na sidebar
  const links = document.querySelectorAll(".sidebar-links a");
  const currentPage = window.location.pathname.split("/").pop().split("?")[0] || "index.html";

  links.forEach(link => link.classList.remove("active"));
  links.forEach(link => {
    const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];
    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });
}

// Inicia a verificação de login do Firebase
function initializeAuthGuard() {
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
    initializeAuthGuard();
  });
