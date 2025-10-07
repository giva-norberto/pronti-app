// ======================================================================
// menu-lateral.js (CORREÇÃO PARA O BOTÃO SAIR FUNCIONAR)
// Este é o arquivo que está sendo usado na prática
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Função para aplicar permissões do menu lateral
export async function aplicarPermissoesMenuLateral(papelUsuario) {
  try {
    const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
    const permissoesSnap = await getDoc(permissoesRef);
    const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
    const menus = regras.menus || {};

    document.querySelectorAll('.sidebar-links [data-menu-id]').forEach(link => {
      const id = link.dataset.menuId;
      const regra = menus[id];
      // Se não houver regra específica para um menu, ele é visível para todos por padrão.
      const podeVer = !regra || regra[papelUsuario] === true;
      link.style.display = podeVer ? "" : "none";
    });
  } catch (error) {
    console.error("Erro ao aplicar permissões no menu lateral:", error);
  }
}

// --- Ativa menu lateral (VERSÃO CORRIGIDA) ---
export function ativarMenuLateral(papelUsuario) {
  const nomePaginaAtual = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
  document.querySelectorAll('.sidebar-links a').forEach(link => {
    link.classList.remove('active');
    const linkPagina = link.getAttribute('href').split('/').pop().split('?')[0].split('#')[0];
    if (linkPagina === nomePaginaAtual || (nomePaginaAtual === '' && linkPagina === 'index.html')) {
      link.classList.add('active');
    }
  });

  // CORREÇÃO DO BOTÃO LOGOUT
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    console.log("Botão logout encontrado, configurando event listener...");
    
    // Remove qualquer listener existente
    const newBtnLogout = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(newBtnLogout, btnLogout);

    // Adiciona o event listener
    newBtnLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log("Botão logout clicado, iniciando processo...");
      
      try {
        console.log("Fazendo signOut...");
        await signOut(auth);
        
        console.log("Limpando storage...");
        localStorage.clear();
        sessionStorage.clear();
        
        console.log("Redirecionando para login...");
        window.location.href = "login.html";
      } catch (erro) {
        console.error("Erro ao tentar fazer logout:", erro);
        alert("Erro ao sair da conta: " + erro.message);
      }
    });
    
    console.log("Event listener do logout configurado com sucesso!");
  } else {
    console.error("ERRO: Botão logout não encontrado!");
  }

  // Aplicar permissões se o papel foi fornecido
  if (papelUsuario) {
    aplicarPermissoesMenuLateral(papelUsuario);
  }
}
