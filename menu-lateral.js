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

// UID do administrador global
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// Função para determinar o perfil do usuário (NÃO MUDA )
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

// Função que mostra/esconde elementos de forma segura
const setVisibility = (selector, shouldShow) => {
  document.querySelectorAll(selector).forEach(el => {
    if (el) {
      el.style.display = shouldShow ? "" : "none"; // Usa "" para voltar ao padrão do CSS
    }
  });
};

// Função principal que configura a página
async function setupAuthenticatedFeatures(user) {
  const sidebar = document.getElementById('sidebar');
  
  try {
    const userRole = await getUserRole(user);

    // ==================================================================
    //          LÓGICA CORRIGIDA PARA DONO E FUNCIONÁRIO
    // ==================================================================
    if (userRole === "dono") {
      // SE FOR DONO: MOSTRA TUDO (MENUS E CARDS)
      setVisibility(".menu-func, .menu-dono, .menu-admin", true);
      setVisibility(".card-func, .card-dono, .card-admin", true);
    } else { // Para "funcionario" e qualquer outro caso
      // SE FOR FUNCIONÁRIO: MOSTRA SÓ O BÁSICO
      setVisibility(".menu-func", true);
      setVisibility(".menu-dono, .menu-admin", false);
      
      setVisibility(".card-func", true);
      setVisibility(".card-dono, .card-admin", false);
    }
    // ==================================================================

    // Lógica do botão de logout (NÃO MUDA)
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

    // Lógica para destacar link ativo (NÃO MUDA)
    const links = document.querySelectorAll(".sidebar-links a");
    const currentPage = window.location.pathname.split("/").pop().split("?")[0] || "index.html";
    links.forEach(link => {
      if (link) {
        const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];
        if (linkPage === currentPage) link.classList.add("active");
        else link.classList.remove("active");
      }
    });

  } catch (error) {
    console.error("Erro ao configurar a página:", error);
  } finally {
    // Garante que o menu sempre apareça, evitando a tela em branco
    if (sidebar) {
      sidebar.classList.remove('sidebar-loading');
    }
  }
}

// Inicia a verificação de login do Firebase (NÃO MUDA)
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
      document.getElementById('sidebar')?.classList.remove('sidebar-loading');
    }
  });
}

// Garante persistência e inicia o guardião (NÃO MUDA)
setPersistence(auth, browserLocalPersistence)
  .then(() => initializeAuthGuard())
  .catch((error) => {
    console.error("Guardião: Falha na persistência!", error);
    initializeAuthGuard();
  });
