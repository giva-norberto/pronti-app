/**
 * login.js
 * * Este script lida com a autenticação de usuários via Google
 * e os redireciona para o dashboard após o login.
 */

import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const btnLoginGoogle = document.getElementById('btn-login-google');

// Checa se o usuário JÁ está logado.
// Se estiver, redireciona direto para o dashboard, evitando que ele veja a tela de login.
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Usuário já está logado. Redirecionando para o dashboard...");
    window.location.href = 'dashboard.html';
  }
});


// Adiciona o evento de clique ao botão de login com Google.
btnLoginGoogle.addEventListener('click', () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      // Login bem-sucedido!
      const user = result.user;
      console.log("Login com Google bem-sucedido para:", user.displayName);
      
      // Redireciona para o dashboard após o sucesso.
      window.location.href = 'dashboard.html';

    }).catch((error) => {
      // Lida com erros de login.
      console.error("Erro no login com Google:", error);
      const errorCode = error.code;
      const errorMessage = error.message;
      alert(`Erro ao fazer login: ${errorMessage}`);
    });
});
