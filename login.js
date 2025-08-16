// login.js

// 1. IMPORTS DO FIREBASE (Unimos tudo que é necessário)
import {
  onAuthStateChanged,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword, // Adicionado para o login manual
  GoogleAuthProvider        // Adicionado para organizar
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Usando o nome do seu arquivo de configuração
import { auth, provider } from "./vitrini-firebase.js"; 
import { showCustomAlert } from "./custom-alert.js";

// --- INÍCIO DA LÓGICA ---

// Garantimos que o código só rode depois que o HTML estiver pronto
window.addEventListener('DOMContentLoaded', () => {

  // 2. SELEÇÃO DE TODOS OS ELEMENTOS
  const btnLoginGoogle = document.getElementById('btn-login-google');
  const loginForm = document.getElementById('login-form');
  const loginStatusDiv = document.getElementById('login-status');

  // 3. LÓGICA DE PERSISTÊNCIA E AUTO-LOGIN (A sua lógica, mantida!)
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      // Checa se o usuário já está logado ao carregar a página
      onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log("Usuário já está logado. Redirecionando...");
          if (!window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'dashboard.html';
          }
        } else {
            console.log("Nenhum usuário logado.");
        }
      });
    })
    .catch((err) => {
      console.error('Erro ao definir persistência do login:', err);
    });

  // 4. LÓGICA DO LOGIN COM GOOGLE (A sua lógica, com pequenas melhorias)
  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener('click', async () => {
      btnLoginGoogle.disabled = true;
      loginStatusDiv.textContent = ""; // Limpa erros
      try {
        await signInWithPopup(auth, provider);
        // O onAuthStateChanged acima vai detectar a mudança e redirecionar
      } catch (error) {
        console.error("Erro no login com Google:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
          loginStatusDiv.textContent = 'Não foi possível fazer login com o Google.';
        }
      } finally {
        btnLoginGoogle.disabled = false;
      }
    });
  }

  // 5. LÓGICA DO LOGIN MANUAL (A que adicionamos)
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        loginStatusDiv.textContent = ""; // Limpa erros

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-senha').value;
        
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // O onAuthStateChanged vai detectar a mudança e redirecionar
        } catch (error) {
            console.error("Erro no login manual:", error.code);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                loginStatusDiv.textContent = 'E-mail ou senha inválidos.';
            } else {
                loginStatusDiv.textContent = 'Ocorreu um erro. Tente novamente.';
            }
        } finally {
            submitButton.disabled = false;
        }
    });
  }
});
