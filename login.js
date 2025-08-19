// ======================================================================
//                          LOGIN.JS (Corrigido)
//       Versão com controle de loop para evitar travamentos
// ======================================================================

import { onAuthStateChanged, signInWithPopup, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, provider } from "./vitrini-firebase.js"; 
import { ensureUserAndTrialDoc, verificarAcesso } from "./userService.js";

// Flag para garantir que a lógica de login/redirecionamento rode apenas uma vez
let isHandlingLogin = false;

/**
 * Centraliza o processo pós-login, chamando o "porteiro" para redirecionar.
 */
async function handleSuccessfulLogin(user) {
    // Se já estamos a processar um login, não faz nada para evitar loops
    if (isHandlingLogin) return;
    isHandlingLogin = true;

    try {
        // Garante que o documento do usuário e o trial existam
        await ensureUserAndTrialDoc();
        // Chama o "porteiro" que irá fazer o redirecionamento
        await verificarAcesso();
    } catch (error) {
        // ======================================================================
        //                      CORREÇÃO APLICADA AQUI
        // ======================================================================
        // Se verificarAcesso rejeitar, é porque iniciou um redirecionamento.
        // A página vai descarregar, então o loop é quebrado.
        // Não fazemos mais nada aqui para evitar reiniciar o processo de login.
        console.log("Processo de login interrompido para redirecionamento:", error.message);
        // A linha "isHandlingLogin = false" foi REMOVIDA daqui.
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Assumindo que os IDs dos seus elementos são estes. Se forem diferentes, ajuste aqui.
    const btnLoginGoogle = document.getElementById('btn-login-google');
    const loginForm = document.getElementById('login-form');
    const loginStatusDiv = document.getElementById('login-status');

    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    console.log("Usuário detectado. Iniciando verificação de acesso...");
                    handleSuccessfulLogin(user);
                } else {
                    console.log("Nenhum usuário logado.");
                    // Libera a trava se o usuário deslogar, permitindo um novo login.
                    isHandlingLogin = false; 
                }
            });
        })
        .catch((err) => {
            console.error('Erro ao definir persistência do login:', err);
        });

    // Lógica do Login com Google
    if (btnLoginGoogle) {
        btnLoginGoogle.addEventListener('click', async () => {
            btnLoginGoogle.disabled = true;
            try {
                await signInWithPopup(auth, provider);
                // O onAuthStateChanged acima vai detetar a mudança e fazer o resto.
            } catch (error) {
                console.error("Erro no login com Google:", error);
                if (loginStatusDiv && error.code !== 'auth/popup-closed-by-user') {
                    loginStatusDiv.textContent = 'Não foi possível fazer login com o Google.';
                }
                btnLoginGoogle.disabled = false; // Reativa o botão em caso de erro.
            }
        });
    }

    // Lógica do Login com E-mail e Senha
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-senha').value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // O onAuthStateChanged acima vai detetar a mudança e fazer o resto.
            } catch (error) {
                console.error("Erro no login manual:", error.code);
                 if (loginStatusDiv) {
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        loginStatusDiv.textContent = 'E-mail ou senha inválidos.';
                    } else {
                        loginStatusDiv.textContent = 'Ocorreu um erro. Tente novamente.';
                    }
                 }
                submitButton.disabled = false; // Reativa o botão em caso de erro.
            }
        });
    }
});
