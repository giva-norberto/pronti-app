// CORREÇÃO: Versão do Firebase mantida em 10.12.2
import { onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
            // Garante que o redirecionamento não aconteça se já estivermos no dashboard
            if (!window.location.pathname.includes('dashboard.html')) {
                window.location.href = 'dashboard.html';
            }
        }
    });

    // Adiciona o evento de clique ao botão de login com Google
    btnLoginGoogle.addEventListener('click', async () => {
        btnLoginGoogle.disabled = true;
        try {
            const result = await signInWithPopup(auth, provider); // Usa o 'auth' e 'provider' importados
            console.log("Login com Google bem-sucedido para:", result.user.displayName);
            window.location.href = 'dashboard.html'; // Redireciona após o login
        } catch (error) {
            console.error("Erro no login com Google:", error);
            // Evita alerta para ação normal do usuário de fechar o popup
            if (error.code !== 'auth/popup-closed-by-user') {
                alert(`Erro ao fazer login: ${error.message}`);
            }
        } finally {
            btnLoginGoogle.disabled = false;
        }
    });
}
