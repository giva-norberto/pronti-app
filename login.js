// CORREÇÃO: Versão do Firebase atualizada para 10.12.2
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// ATENÇÃO: O nome do arquivo de configuração deve ser o mesmo do nosso projeto
import { app } from "./vitrini-firebase.js"; // Alterado de firebase-config.js para vitrini-firebase.js

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// O ID do botão deve corresponder ao seu HTML
const btnLoginGoogle = document.getElementById('btn-login-google');

if (!btnLoginGoogle) {
    console.error("Botão com id 'btn-login-google' não foi encontrado!");
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
        btnLoginGoogle.disabled = true;
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Login com Google bem-sucedido para:", result.user.displayName);
            window.location.href = 'dashboard.html'; // Redireciona após o login
        } catch (error) {
            console.error("Erro no login com Google:", error);
            alert(`Erro ao fazer login: ${error.message}`);
        } finally {
            btnLoginGoogle.disabled = false;
        }
    });
}
