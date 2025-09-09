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
// NENHUMA MUDANÇA AQUI
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

  // -------- Lógica para mostrar/ocultar menus conforme o perfil (AJUSTADA) -----------
  // A lógica IF/ELSE é a mesma, mas o modo de exibição foi melhorado.
  // Usamos 'flex' porque é o display correto dos seus links.
  if (userRole === "funcionario") {
    document.querySelectorAll(".menu-func").forEach(e => e.style.display = "flex");
    document.querySelectorAll(".menu-admin, .menu-dono").forEach(e => e.style.display = "none");
  } else if (userRole === "admin") {
    document.querySelectorAll(".menu-admin, .menu-func").forEach(e => e.style.display = "flex");
    document.querySelectorAll(".menu-dono").forEach(e => e.style.display = "none");
  } else if (userRole === "dono") {
    // Sua lógica original mostrava admin para o dono. Mantive isso.
    // Se o dono não deve ver o menu de admin, remova '.menu-admin' da linha abaixo.
    document.querySelectorAll(".menu-admin, .menu-dono, .menu-func").forEach(e => e.style.display = "flex");
  }
  // ------------------------------------------------------------------------------

  // NOVO: Remove a classe de carregamento para exibir os menus corretos de uma vez.
  document.getElementById('sidebar')?.classList.remove('sidebar-loading');

  // Lógica do botão de logout (NENHUMA MUDANÇA AQUI)
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

  // Lógica para destacar o link ativo na sidebar (NENHUMA MUDANÇA AQUI)
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

// Inicia a verificação de login do Firebase (NENHUMA MUDANÇA AQUI)
function initializeAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith("login.html");
    const needsCompany = !isLoginPage && !window.location.pathname.endsWith("selecionar-empresa.html");
    const companyId = localStorage.getItem("empresaAtivaId");

    if (!user && !isLoginPage) {
      // Adiciona a classe de carregamento para garantir que o menu não pisque antes do redirecionamento
      document.getElementById('sidebar')?.classList.add('sidebar-loading');
      window.location.replace("login.html");
    } else if (user && needsCompany && !companyId) {
      document.getElementById('sidebar')?.classList.add('sidebar-loading');
      window.location.replace("selecionar-empresa.html");
    } else if (user) {
      setupAuthenticatedFeatures(user);
    } else {
      // Se for a página de login, remove a classe para que o layout não quebre
      document.getElementById('sidebar')?.classList.remove('sidebar-loading');
    }
  });
}

// Garante persistência e inicia o guardião (NENHUMA MUDANÇA AQUI)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    initializeAuthGuard();
  })
  .catch((error) => {
    console.error("Guardião do Menu: Falha ao ativar persistência!", error);
    initializeAuthGuard();
  });
