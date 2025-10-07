// ======================================================================
// menu-lateral.js (CORREÇÃO PARA O BOTÃO SAIR FUNCIONAR)
// Resolvido: botão "Sair" sempre funciona!
// ======================================================================

// Importações do Firebase
import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Função para aplicar permissões do menu lateral
export async function aplicarPermissoesMenuLateral(papelUsuario) {
  try {
    // Busca regras de permissões no Firestore
    const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
    const permissoesSnap = await getDoc(permissoesRef);
    const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
    const menus = regras.menus || {};

    // Aplica visibilidade dos menus por papel do usuário
    document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
      const id = link.dataset.menuId;
      const regra = menus[id];
      // Se não houver regra específica, menu é visível por padrão
      const podeVer = !regra || regra[papelUsuario] === true;
      link.style.display = podeVer ? "" : "none";
    });
  } catch (error) {
    console.error("Erro ao aplicar permissões no menu lateral:", error);
  }
}

// Função para ativar o menu lateral e botão sair
export function ativarMenuLateral(papelUsuario) {
  // Destaca o menu da página atual
  const nomePaginaAtual = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
  document.querySelectorAll('.sidebar-links a').forEach(link => {
    link.classList.remove('active');
    const linkPagina = link.getAttribute('href').split('/').pop().split('?')[0].split('#')[0];
    if (linkPagina === nomePaginaAtual || (nomePaginaAtual === '' && linkPagina === 'index.html')) {
      link.classList.add('active');
    }
  });

  // BOTÃO SAIR: garante que o event listener é adicionado corretamente
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    // Remove listeners antigos clonando o botão
    const newBtnLogout = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(newBtnLogout, btnLogout);

    // Adiciona o event listener para logout
    newBtnLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        await signOut(auth); // Sai do Firebase Auth
        localStorage.clear(); // Limpa storage local
        sessionStorage.clear();
        window.location.href = "login.html"; // Redireciona para login
      } catch (erro) {
        alert("Erro ao sair da conta: " + erro.message);
        console.error("Erro ao tentar fazer logout:", erro);
      }
    });
  } else {
    console.error("ERRO: Botão logout não encontrado!");
  }

  // Aplica permissões se houver papel do usuário
  if (papelUsuario) {
    aplicarPermissoesMenuLateral(papelUsuario);
  }
}
