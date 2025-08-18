// ======================================================================
//                         LOGIN.JS
//      VERSÃO FINAL COM REGISTRO DE TRIAL E REDIRECIONAMENTO INTELIGENTE
// ======================================================================

// 1. IMPORTS DO FIREBASE E SERVIÇOS
import {
  onAuthStateChanged,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Usando o nome do seu arquivo de configuração
import { auth, provider } from "./vitrini-firebase.js"; 
import { showCustomAlert } from "./custom-alert.js";

// NOVA IMPORTAÇÃO dos nossos serviços de usuário do arquivo que centralizamos
import { ensureUserAndTrialDoc, verificarAcesso } from "./userService.js";

// --- INÍCIO DA LÓGICA ---

// Flag para evitar múltiplos redirecionamentos e garantir que a lógica rode apenas uma vez
let isHandlingLogin = false;

/**
 * ADICIONADO: Esta função agora centraliza todo o processo pós-login.
 */
async function handleSuccessfulLogin(user) {
  // Se já estamos processando um login, não faz nada para evitar loops
  if (isHandlingLogin) return;
  isHandlingLogin = true;

  try {
    // Passo 1: Garante que o documento do usuário e o registro do trial existam.
    // Esta função foi consolidada no seu userService.js
    await ensureUserAndTrialDoc();

    // Passo 2: Chama o "porteiro" para fazer a verificação e o redirecionamento correto.
    // A função verificarAcesso já sabe se deve enviar para o dashboard, perfil ou aguardando.
    await verificarAcesso();
    
  } catch (error) {
    // Se ocorrer um erro aqui, significa que o usuário foi redirecionado (acesso negado, etc)
    // ou houve um erro grave no Firestore. O erro já é logado pelo userService.
    console.error("Falha no processo pós-login:", error.message);
    isHandlingLogin = false; // Libera a trava em caso de erro para permitir nova tentativa
  }
}

// Garantimos que o código só rode depois que o HTML estiver pronto
window.addEventListener('DOMContentLoaded', () => {

  // 2. SELEÇÃO DE TODOS OS ELEMENTOS (Sua lógica original, mantida)
  const btnLoginGoogle = document.getElementById('btn-login-google');
  const loginForm = document.getElementById('login-form');
  const loginStatusDiv = document.getElementById('login-status');

  // ======================================================================
  // MODIFICADO: O onAuthStateChanged agora usa nossa lógica inteligente.
  // ======================================================================
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      // Checa se o usuário já está logado ao carregar a página
      onAuthStateChanged(auth, (user) => {
        if (user) {
          // Usuário está logado. Em vez de redirecionar direto,
          // chamamos nossa função inteligente para decidir o que fazer.
          console.log("Usuário detectado. Iniciando verificação de acesso...");
          handleSuccessfulLogin(user);
        } else {
            console.log("Nenhum usuário logado.");
            isHandlingLogin = false; // Garante que a trava seja liberada se o usuário deslogar
        }
      });
    })
    .catch((err) => {
      console.error('Erro ao definir persistência do login:', err);
    });

  // 4. LÓGICA DO LOGIN COM GOOGLE (Sua lógica original, mantida)
  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener('click', async () => {
      btnLoginGoogle.disabled = true;
      loginStatusDiv.textContent = ""; // Limpa erros
      try {
        await signInWithPopup(auth, provider);
        // SUCESSO! O onAuthStateChanged acima vai detectar a mudança e
        // chamar o handleSuccessfulLogin para fazer o resto do trabalho.
      } catch (error) {
        console.error("Erro no login com Google:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
          loginStatusDiv.textContent = 'Não foi possível fazer login com o Google.';
        }
        // Só reabilita o botão se der erro. Em caso de sucesso, a página vai redirecionar.
        btnLoginGoogle.disabled = false;
      }
    });
  }

  // 5. LÓGICA DO LOGIN MANUAL (Sua lógica original, mantida)
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
            // SUCESSO! O onAuthStateChanged acima vai detectar a mudança e
            // chamar o handleSuccessfulLogin para fazer o resto do trabalho.
        } catch (error) {
            console.error("Erro no login manual:", error.code);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                loginStatusDiv.textContent = 'E-mail ou senha inválidos.';
            } else {
                loginStatusDiv.textContent = 'Ocorreu um erro. Tente novamente.';
            }
            submitButton.disabled = false;
        }
    });
  }
});
