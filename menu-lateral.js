// ======================================================================
// menu-lateral.js (CORREÇÃO FINAL DO BOTÃO SAIR)
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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

export function ativarMenuLateral(papelUsuario) {
  // Destaca o menu atual
  const nomePaginaAtual = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
  document.querySelectorAll('.sidebar-links a').forEach(link => {
    link.classList.remove('active');
    const linkPagina = link.getAttribute('href').split('/').pop().split('?')[0].split('#')[0];
    if (linkPagina === nomePaginaAtual || (nomePaginaAtual === '' && linkPagina === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Espera o botão existir no DOM
  const observarBotaoLogout = () => {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      // Remove listeners antigos (clonagem)
      const newBtnLogout = btnLogout.cloneNode(true);
      btnLogout.parentNode.replaceChild(newBtnLogout, btnLogout);

      newBtnLogout.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await signOut(auth);
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "login.html";
        } catch (erro) {
          console.error("Erro ao tentar fazer logout:", erro);
          alert("Erro ao sair: " + erro.message);
        }
      });

      console.log("✅ Botão sair ativado com sucesso.");
      return true;
    }
    return false;
  };

  // Se não existir ainda, aguarda via MutationObserver
  if (!observarBotaoLogout()) {
    const observer = new MutationObserver(() => {
      if (observarBotaoLogout()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Aplica permissões
  if (papelUsuario) aplicarPermissoesMenuLateral(papelUsuario);
}
