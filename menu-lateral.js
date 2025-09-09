alert("TESTE: O arquivo auth-guard.js CARREGOU!");
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

// UID do super-administrador.
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// --> FUNÇÃO SEM ALTERAÇÕES: A lógica para determinar o papel do usuário está correta
//     e é específica do seu banco de dados.
async function getUserRole(user) {
  if (!user) return "funcionario";
  if (user.uid === ADMIN_UID) return "admin";

  const empresaId = localStorage.getItem("empresaAtivaId");
  if (!empresaId) return "funcionario";

  try {
    const profRef = doc(db, "empresas", empresaId, "profissionais", user.uid);
    const profSnap = await getDoc(profRef);

    if (profSnap.exists() && profSnap.data().ehDono) {
      return "dono";
    }
  } catch (err) {
    console.error("Erro ao buscar perfil no Firestore:", err);
  }

  return "funcionario";
}

// --> FUNÇÃO UTILITÁRIA SEM ALTERAÇÕES
function setVisibility(selector, displayStyle) {
  document.querySelectorAll(selector).forEach(el => {
    if (el) el.style.display = displayStyle;
  });
}

// --> LÓGICA REVISADA: Apenas mostra os elementos permitidos. Não esconde mais nada.
//     Isso evita o efeito de "piscada" na tela.
function updateUIVisibility(role) {
  console.log(`DEBUG: Atualizando a visibilidade para o perfil: ${role}`);

  // Usamos 'switch' para deixar as regras de cada perfil mais claras.
  switch (role) {
    case 'admin':
      // Mostra os elementos específicos do admin.
      setVisibility(".menu-admin, .card-admin", "flex");
      // ATENÇÃO: Não há 'break' aqui de propósito.
      // A execução continua no 'case: dono' para que o admin também veja tudo que o dono vê.

    case 'dono':
      // Mostra os elementos de dono (que o admin também verá).
      setVisibility(".menu-dono, .card-dono", "flex");
      break; // O dono não tem mais permissões, então paramos aqui.

    case 'funcionario':
    default:
      // Não fazemos nada. Os elementos de funcionário já são visíveis por padrão no HTML,
      // e os elementos restritos já estão escondidos.
      break;
  }
}

// --> NOVO: Função para configurar recursos que só precisam rodar uma vez por página.
//     Isso organiza melhor o código.
function setupPageFeatures() {
  // Configura o botão de logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout && !btnLogout.dataset.listenerAttached) {
    btnLogout.dataset.listenerAttached = 'true'; // Evita adicionar o evento múltiplas vezes
    btnLogout.addEventListener("click", () => {
      signOut(auth).then(() => {
        localStorage.clear();
        window.location.replace("login.html");
      });
    });
  }

  // Destaca o link ativo no menu lateral
  const links = document.querySelectorAll(".sidebar-links a");
  const currentPage = window.location.pathname.split("/").pop().split("?")[0] || "index.html";
  links.forEach(link => {
    if (link) {
      const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];
      link.classList.toggle('active', linkPage === currentPage);
    }
  });
}

// --> LÓGICA PRINCIPAL REVISADA: Orquestra a verificação de autenticação e
//     a atualização da interface.
function initializeAuthGuard() {
  onAuthStateChanged(auth, async (user) => {
    const isLoginPage = window.location.pathname.endsWith("login.html");
    const needsCompany = !isLoginPage && !window.location.pathname.endsWith("selecionar-empresa.html");
    const companyId = localStorage.getItem("empresaAtivaId");

    if (user) {
      // Usuário está logado.
      if (needsCompany && !companyId) {
        console.log("DEBUG: Logado, mas sem empresa. Redirecionando para seleção.");
        window.location.replace("selecionar-empresa.html");
        return; // Interrompe a execução aqui.
      }
      
      console.log("DEBUG: Usuário autenticado e com contexto. Configurando a página.");
      const userRole = await getUserRole(user);
      
      // Mostra todos os menus e cards básicos que todos veem.
      setVisibility(".menu-func, .card-func", "flex");
      
      // Mostra os menus e cards adicionais com base na permissão.
      updateUIVisibility(userRole);
      
      // Configura logout e link ativo.
      setupPageFeatures();

    } else if (!isLoginPage) {
      // Usuário não está logado e não está na página de login, redireciona.
      console.log("DEBUG: Não logado. Redirecionando para login.");
      window.location.replace("login.html");
    }
  });
}

// Inicia o processo de verificação de autenticação.
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("DEBUG: Persistência configurada. Inicializando guardião.");
    initializeAuthGuard();
  })
  .catch((error) => {
    console.error("DEBUG: Falha na persistência! Iniciando guardião mesmo assim.", error);
    initializeAuthGuard();
  });
