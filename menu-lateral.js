import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

document.getElementById("btn-logout")?.addEventListener("click", () => {
    signOut(auth)
      .then(() => {
        localStorage.clear();
        window.location.href = "login.html";
      })
      .catch(err => alert("Erro ao sair: " + err.message));
});

// ATENÇÃO: Se quiser esconder itens do menu por perfil, faça aqui!
// Exemplo:
// const userRole = localStorage.getItem("role");
// if (userRole !== 'admin') document.querySelector('[data-menu-id="administracao"]').style.display = 'none';
