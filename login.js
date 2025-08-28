// ======================================================================
//                          LOGIN.JS (VERSÃO FINAL, SEM LOOP, PERMANECE LOGADO)
// ======================================================================

// Imports (atualizados para 10.13.2 e firebase-config.js)
import { signInWithPopup, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth, provider } from "./firebase-config.js"; 

window.addEventListener('DOMContentLoaded', () => {
    const btnLoginGoogle = document.getElementById('btn-login-google');
    const loginForm = document.getElementById('login-form');
    const loginStatusDiv = document.getElementById('login-status');

    // ======================================================================
    //      onAuthStateChanged NÃO está presente nesta página.
    //      O gerenciamento de sessão/logado ocorre em userService.js e/ou
    //      nas páginas protegidas (index, perfil, etc).
    //      O Firebase Auth mantém o usuário autenticado por padrão (local).
    // ======================================================================

    // Lógica do Login com Google
    if (btnLoginGoogle) {
        btnLoginGoogle.addEventListener('click', async () => {
            btnLoginGoogle.disabled = true;
            if (loginStatusDiv) loginStatusDiv.textContent = "";

            try {
                await signInWithPopup(auth, provider);
                // SUCESSO! Redireciona para a página principal, que fará a verificação.
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Erro no login com Google:", error);
                if (loginStatusDiv && error.code !== 'auth/popup-closed-by-user') {
                    loginStatusDiv.textContent = 'Não foi possível fazer login com o Google.';
                }
                btnLoginGoogle.disabled = false;
            }
        });
    }

    // Lógica do Login com E-mail e Senha
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (loginStatusDiv) loginStatusDiv.textContent = "";

            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-senha').value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // SUCESSO! Redireciona para a página principal, que fará a verificação.
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Erro no login manual:", error.code);
                if (loginStatusDiv) {
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        loginStatusDiv.textContent = 'E-mail ou senha inválidos.';
                    } else {
                        loginStatusDiv.textContent = 'Ocorreu um erro. Tente novamente.';
                    }
                }
                submitButton.disabled = false;
            }
        });
    }
});
