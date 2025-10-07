// ======================================================================
// menu-lateral.js (VERSÃO FINAL - BOTÃO SAIR 100% FUNCIONAL)
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ======================================================================
// Função: aplicarPermissoesMenuLateral
// Controla visibilidade dos itens do menu conforme papel do usuário
// ======================================================================
export async function aplicarPermissoesMenuLateral(papelUsuario) {
  try {
    const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
    const permissoesSnap = await getDoc(permissoesRef);
    const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
    const menus = regras.menus || {};

    document.querySelectorAll(".sidebar-links [data-menu-id]").forEach(link => {
      const id = link.dataset.menuId;
      const regra = menus[id];
      const podeVer = !regra || regra[papelUsuario] === true;
      link.style.display = podeVer ? "" : "none";
    });
  } catch (error) {
    console.error("Erro ao aplicar permissões no menu lateral:", error);
  }
}

// ======================================================================
// Função: ativarMenuLateral
// Destaca a página ativa e configura o botão de logout
// ======================================================================
export function ativarMenuLateral(papelUsuario) {
  try {
    // ------------------------------
    // 1️⃣ Destacar o menu atual
    // ------------------------------
    const nomePaginaAtual = window.location.pathname.split("/").pop().split("?")[0].split("#")[0];
    document.querySelectorAll(".sidebar-links a").forEach(link => {
      link.classList.remove("active");
      const linkPagina = link.getAttribute("href").split("/").pop().split("?")[0].split("#")[0];
      if (linkPagina === nomePaginaAtual || (nomePaginaAtual === "" && linkPagina === "index.html")) {
        link.classList.add("active");
      }
    });

    // ------------------------------
    // 2️⃣ Configurar botão "Sair" (Logout)
    // ------------------------------
    if (!window.__logoutHandlerPronti) {
      window.__logoutHandlerPronti = true;

      document.addEventListener(
        "click",
        async (e) => {
          const btn = e.target.closest("#btn-logout");
          if (!btn) return; // clique não é no botão sair

          e.preventDefault();
          e.stopPropagation();
          console.log("[menu-lateral] Clique em sair detectado.");

          try {
            if (!auth) {
              console.error("[menu-lateral] auth não está disponível.");
              alert("Erro interno: autenticação não disponível.");
              return;
            }

            console.log("[menu-lateral] Fazendo signOut...", auth.currentUser);
            await signOut(auth);

            // Limpa caches locais
            localStorage.clear();
            sessionStorage.clear();

            console.log("[menu-lateral] Logout concluído. Redirecionando para login...");
            window.location.replace("login.html");
          } catch (erro) {
            console.error("[menu-lateral] Erro ao tentar sair:", erro);
            alert("Erro ao sair: " + erro.message);
          }
        },
        true // captura o evento cedo (mais confiável)
      );
    }

    // ------------------------------
    // 3️⃣ Aplicar permissões do menu
    // ------------------------------
    if (papelUsuario) {
      aplicarPermissoesMenuLateral(papelUsuario);
    }
  } catch (erro) {
    console.error("Erro ao ativar menu lateral:", erro);
  }
}
