// login.js - VERSÃO FINAL COM PERSISTÊNCIA DE LOGIN

// ALTERAÇÃO: Adicionadas as funções 'setPersistence' e 'browserLocalPersistence'
import { onAuthStateChanged, signInWithPopup, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importa 'auth' e 'provider' já criados do arquivo de configuração central
import { auth, provider } from "./vitrini-firebase.js"; 

// O ID do botão deve corresponder ao seu HTML
const btnLoginGoogle = document.getElementById('btn-login-google'); 

if (!btnLoginGoogle) {
    console.error("Botão com id 'btn-login-google' não foi encontrado!");
} else {
    // Checa se o usuário já está logado
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuário já está logado. Redirecionando para o dashboard...");
            if (!window.location.pathname.includes('dashboard.html')) {
                window.location.href = 'dashboard.html';
            }
        }
    });

    // Adiciona o evento de clique ao botão de login com Google
    btnLoginGoogle.addEventListener('click', async () => {
        btnLoginGoogle.disabled = true;
        try {
            // ==========================================================
            // ALTERAÇÃO: Esta é a linha que resolve o problema.
            // Ela força o Firebase a "lembrar" do usuário permanentemente.
            // ==========================================================
            await setPersistence(auth, browserLocalPersistence);

            const result = await signInWithPopup(auth, provider);
            console.log("Login com Google bem-sucedido para:", result.user.displayName);
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error("Erro no login com Google:", error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert(`Erro ao fazer login: ${error.message}`);
            }
        } finally {
            btnLoginGoogle.disabled = false;
        }
    });
}
