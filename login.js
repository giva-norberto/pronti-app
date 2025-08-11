import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, auth } from "./firebase-config.js";

console.log("Script login.js carregado!");

const btnLoginGoogle = document.getElementById('btn-login-google');
const loginStatus = document.getElementById('login-status');
const provider = new GoogleAuthProvider();

// Checa se o usuário JÁ está logado
onAuthStateChanged(auth, (user) => {
  console.log("onAuthStateChanged disparou!", user);
  if (user) {
    if (loginStatus) loginStatus.textContent = "Login realizado! Redirecionando...";
    window.location.href = 'dashboard.html';
  } else {
    if (loginStatus) loginStatus.textContent = "Faça login com Google.";
  }
});

if (btnLoginGoogle) {
  btnLoginGoogle.addEventListener('click', async () => {
    console.log("Botão Google clicado!");
    btnLoginGoogle.disabled = true;
    if (loginStatus) loginStatus.textContent = "Iniciando login com Google...";
    try {
      const result = await signInWithPopup(auth, provider);
      // Se deu certo, vai redirecionar pelo onAuthStateChanged
    } catch (error) {
      console.error("Erro no login com Google:", error);
      if (loginStatus) {
        if (error.code === "auth/popup-closed-by-user") {
          loginStatus.textContent = "Você fechou a janela de login antes de concluir. Tente novamente.";
        } else if (error.code === "auth/unauthorized-domain") {
          loginStatus.textContent = "Domínio não autorizado no Firebase. Cadastre o domínio em Authentication > Authorized domains.";
        } else {
          loginStatus.textContent = `Erro ao fazer login: ${error.message}`;
        }
      }
    } finally {
      btnLoginGoogle.disabled = false;
    }
  });
}
