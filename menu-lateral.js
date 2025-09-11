import { db, auth } from "./firebase-config.js"; 
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const perfil = localStorage.getItem("perfil"); // "admin", "dono", "funcionario"

async function aplicarPermissoesGlobaisMenu() {
  try {
    const doc = await db.collection("configuracoesGlobais").doc("permissoes").get();
    if (!doc.exists) {
      console.warn("Permissões globais de menu não configuradas!");
      return;
    }
    const permissoes = doc.data();
    Object.keys(permissoes).forEach(menuId => {
      const podeVer = permissoes[menuId]?.[perfil];
      if (!podeVer) {
        document.querySelector(`[data-menu-id="${menuId}"]`)?.classList.add("hidden");
      }
    });
  } catch (err) {
    console.error("Erro ao buscar permissões globais:", err);
  }
}

// resto: logout, link ativo, etc.
