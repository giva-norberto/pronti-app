// ======================================================================
//             LOGIN.JS (VERSÃO FINAL E CORRIGIDA)
// ======================================================================

import {
    signInWithPopup,
    signInWithRedirect,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import { auth, provider } from "./firebase-config.js";

function isMobileOuPWA() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

    return isMobile || isStandalone;
}

window.addEventListener("DOMContentLoaded", () => {
    const btnLoginGoogle = document.getElementById("btn-login-google");
    const loginForm = document.getElementById("login-form");
    const loginStatusDiv = document.getElementById("login-status");

    if (btnLoginGoogle) {
        btnLoginGoogle.addEventListener("click", async () => {
            btnLoginGoogle.disabled = true;

            if (loginStatusDiv) {
                loginStatusDiv.textContent = "";
            }

            try {
                if (isMobileOuPWA()) {
                    await signInWithRedirect(auth, provider);
                    return;
                }

                await signInWithPopup(auth, provider);

                window.location.href = "selecionar-empresa.html";

            } catch (error) {
                console.error("Erro no login com Google:", error);

                if (loginStatusDiv && error.code !== "auth/popup-closed-by-user") {
                    loginStatusDiv.textContent = "Não foi possível fazer login com o Google.";
                }

                btnLoginGoogle.disabled = false;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (loginStatusDiv) {
                loginStatusDiv.textContent = "";
            }

            const submitButton = loginForm.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.disabled = true;
            }

            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-senha").value;

            try {
                await signInWithEmailAndPassword(auth, email, password);

                window.location.href = "selecionar-empresa.html";

            } catch (error) {
                console.error("Erro no login manual:", error.code);

                if (loginStatusDiv) {
                    if (
                        error.code === "auth/user-not-found" ||
                        error.code === "auth/wrong-password" ||
                        error.code === "auth/invalid-credential"
                    ) {
                        loginStatusDiv.textContent = "E-mail ou senha inválidos.";
                    } else {
                        loginStatusDiv.textContent = "Ocorreu um erro. Tente novamente.";
                    }
                }

                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }
});
