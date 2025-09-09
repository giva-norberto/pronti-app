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
  if (!user) {
    console.log("DEBUG: Usuário não logado, retornando funcionario.");
    return "funcionario";
  }
  if (user.uid === ADMIN_UID) {
    console.log("DEBUG: Usuário é ADMIN_UID, retornando admin.");
    return "admin";
  }

  try {
    const empresaId = localStorage.getItem("empresaAtivaId");
    console.log("DEBUG: empresaAtivaId do localStorage:", empresaId);
    if (!empresaId) {
      console.log("DEBUG: empresaAtivaId não encontrada, retornando funcionario.");
      return "funcionario";
    }

    const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
    console.log("DEBUG: Buscando documento do profissional em:", profRef.path);
    const profSnap = await getDoc(profRef);

    if (profSnap.exists()) {
      const dados = profSnap.data();
      console.log("DEBUG: Dados do profissional encontrados:", dados);
      if (dados.ehDono) {
        console.log("DEBUG: ehDono é true, retornando dono.");
        return "dono";
      }
    } else {
      console.log("DEBUG: Documento do profissional NÃO encontrado.");
    }
  } catch (err) {
    console.error("DEBUG: Erro ao buscar perfil no Firestore:", err);
  }

  console.log("DEBUG: Nenhuma condição de dono/admin atendida, retornando funcionario.");
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
  console.log("DEBUG: userRole determinado em setupAuthenticatedFeatures:", userRole);

  // Esconde todos os menus e cards por padrão para garantir um estado limpo
  setVisibility(".menu-func, .menu-dono, .menu-admin", "none");
  setVisibility(".card-func, .card-dono, .card-admin", "none");

  if (userRole === "dono" || userRole === "admin") {
    console.log("DEBUG: Perfil é dono ou admin. Mostrando tudo.");
    setVisibility(".menu-func, .menu-dono, .menu-admin", "flex");
    setVisibility(".card-func, .card-dono, .card-admin", "flex");
  } else { 
    console.log("DEBUG: Perfil é funcionario. Mostrando apenas o básico.");
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
      console.log("DEBUG: Não logado e não na página de login, redirecionando.");
      window.location.replace("login.html");
    } else if (user && needsCompany && !companyId) {
      console.log("DEBUG: Logado, precisa de empresa, mas empresaAtivaId não encontrada, redirecionando.");
      window.location.replace("selecionar-empresa.html");
    } else if (user) {
      console.log("DEBUG: Usuário logado, configurando funcionalidades.");
      setupAuthenticatedFeatures(user);
    } else {
      console.log("DEBUG: Na página de login ou sem usuário, garantindo que nada esteja visível.");
      setVisibility(".menu-func, .menu-dono, .menu-admin", "none");
      setVisibility(".card-func, .card-dono, .card-admin", "none");
    }
  });
}

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("DEBUG: Persistência configurada, inicializando guardião.");
    initializeAuthGuard();
  })
  .catch((error) => {
    console.error("DEBUG: Guardião: Falha na persistência!", error);
    initializeAuthGuard();
  });




