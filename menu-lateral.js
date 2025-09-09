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

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

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

function setVisibility(selector, displayStyle) {
  document.querySelectorAll(selector).forEach(el => {
    if (el) {
      el.style.display = displayStyle;
    }
  });
}

async function setupAuthenticatedFeatures(user) {
  const userRole = await getUserRole(user);

  // Esconde todos os menus e cards por padrão para garantir um estado limpo
  setVisibility(".menu-func, .menu-dono, .menu-admin", "none");
  setVisibility(".card-func, .card-dono, .card-admin", "none");

  if (userRole === "dono" || userRole === "admin") {
    // Dono/Admin: Mostra todos os menus e cards
    setVisibility(".menu-func, .menu-dono, .menu-admin", "flex");
    setVisibility(".card-func, .card-dono, .card-admin", "flex");
  } else { 
    // Funcionário: Mostra apenas menus e cards de funcionário
    setVisibility(".menu-func", "flex");
    setVisibility(".card-func", "flex");
  }

  // Lógica de logout e destaque de link ativo (mantida)
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    const newBtn = btnLogout.cloneNode(true);
    if (btnLogout.parentNode) {
      btnLogout.parentNode.replaceChild(newBtn, btnLogout);
      newBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
          localStorage.clear();
          window.location.replace("login.html");
        });
      });
    }
  }

  const links = document.querySelectorAll(".sidebar-links a");
  const currentPage = window.location.pathname.split("/").pop().split("?")[0] || "index.html";
  links.forEach(link => {
    if (link) {
      const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];
      if (linkPage === currentPage) link.classList.add("active");
      else link.classList.remove("active");
    }
  });
}

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
    } else {
      // Se não há usuário e estamos na página de login/seleção, garante que nada esteja visível por padrão
      setVisibility(".menu-func, .menu-dono, .menu-admin", "none");
      setVisibility(".card-func, .card-dono, .card-admin", "none");
    }
  });
}

setPersistence(auth, browserLocalPersistence)
  .then(() => initializeAuthGuard())
  .catch((error) => {
    console.error("Guardião: Falha na persistência!", error);
    initializeAuthGuard();
  });
