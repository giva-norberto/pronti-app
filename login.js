// ======================================================================
//                          LOGIN.JS (Corrigido)
//       Versão simplificada para resolver o conflito de login
// ======================================================================

import { onAuthStateChanged, signInWithPopup, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, provider } from "./vitrini-firebase.js"; 
// A verificação de acesso foi removida desta página para evitar conflitos.
// import { ensureUserAndTrialDoc, verificarAcesso } from "./userService.js";

window.addEventListener('DOMContentLoaded', () => {
    const btnLoginGoogle = document.getElementById('btn-login-google');
    const loginForm = document.getElementById('login-form');
    const loginStatusDiv = document.getElementById('login-status');

    // ======================================================================
    //                      CORREÇÃO APLICADA AQUI
    // ======================================================================
    // O listener onAuthStateChanged foi simplificado. Ele agora apenas verifica
    // se um usuário já tem uma sessão ativa e o redireciona, sem fazer
    // a verificação de acesso complexa, que agora é responsabilidade do index.html.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Se o usuário já está logado (ex: voltou para a página de login),
            // envia-o para a página principal para ser roteado corretamente.
            console.log("Sessão de usuário ativa encontrada, redirecionando...");
            window.location.href = 'index.html';
        }
    });
    // ======================================================================

    // Lógica do Login com Google
    if (btnLoginGoogle) {
        btnLoginGoogle.addEventListener('click', async () => {
            btnLoginGoogle.disabled = true;
            if(loginStatusDiv) loginStatusDiv.textContent = "";

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
            if(loginStatusDiv) loginStatusDiv.textContent = "";

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
