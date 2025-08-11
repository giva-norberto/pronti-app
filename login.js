import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const btnLoginGoogle = document.getElementById('btn-login-google');

if (!btnLoginGoogle) {
  console.error("Botão btn-login-google não encontrado!");
} else {
  // Checa se o usuário já está logado
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Usuário já está logado. Redirecionando para o dashboard...");
      window.location.href = 'dashboard.html';
    }
  });

  // Adiciona o evento de clique ao botão de login com Google
  btnLoginGoogle.addEventListener('click', async () => {
    btnLoginGoogle.disabled = true; // Desabilita o botão para evitar cliques múltiplos
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Login com Google bem-sucedido para:", result.user.displayName);
      window.location.href = 'dashboard.html'; // Redireciona após o login
    } catch (error) {
      console.error("Erro no login com Google:", error);
      alert(`Erro ao fazer login: ${error.message}`);
    } finally {
      btnLoginGoogle.disabled = false; // Reabilita o botão
    }
  });
}
