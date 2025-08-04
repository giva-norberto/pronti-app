import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const btnLoginGoogle = document.getElementById('btn-login-google');

if (!btnLoginGoogle) {
  console.error("Botão btn-login-google não encontrado!");
} else {

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Usuário já está logado. Redirecionando para o dashboard...");
      window.location.href = 'dashboard.html';
    }
  });

  btnLoginGoogle.addEventListener('click', () => {
    btnLoginGoogle.disabled = true; // bloqueia para evitar múltiplos clicks

    signInWithPopup(auth, provider)
      .then((result) => {
        console.log("Login com Google bem-sucedido para:", result.user.displayName);
        window.location.href = 'dashboard.html';
      })
      .catch((error) => {
        console.error("Erro no login com Google:", error);
        alert(`Erro ao fazer login: ${error.message}`);
      })
      .finally(() => {
        btnLoginGoogle.disabled = false; // libera botão
      });
  });
}
