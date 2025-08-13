// RESPONSABILIDADE: Interagir com o Firebase Authentication e
// notificar a aplicação sobre mudanças no estado de login.

import { auth, provider } from './vitrini-firebase.js';

// ======================================================================
// ALTERAÇÃO: Importa as funções de persistência
// ======================================================================
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut,
    setPersistence,
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { showAlert } from './vitrini-utils.js';

/**
 * Configura o listener que observa mudanças no estado de autenticação (login/logout).
 * @param {Function} callback - A função a ser executada quando o estado de auth mudar.
 */
export function setupAuthListener(callback) {
    onAuthStateChanged(auth, (user) => {
        if (callback && typeof callback === 'function') {
            callback(user);
        }
    });
}

/**
 * Inicia o processo de login com o popup do Google e garante a persistência.
 */
export async function fazerLogin() {
    try {
        // ======================================================================
        // ALTERAÇÃO: Esta linha comanda o Firebase a "lembrar" do usuário
        // entre as sessões (mesmo depois de fechar o navegador).
        // ======================================================================
        await setPersistence(auth, browserLocalPersistence);

        await signInWithPopup(auth, provider);
        // O listener 'onAuthStateChanged' cuidará de atualizar a UI automaticamente.
        
    } catch (error) {
        console.error("Erro no login:", error.message);
        // Evita alerta para ação normal do usuário de fechar o popup
        if (error.code !== 'auth/popup-closed-by-user') {
            await showAlert("Erro no Login", "Não foi possível fazer o login. Por favor, tente novamente.");
        }
    }
}

/**
 * Inicia o processo de logout do usuário.
 */
export async function fazerLogout() {
    try {
        await signOut(auth);
        // O listener 'onAuthStateChanged' cuidará de atualizar a UI.
    } catch (error) {
        console.error("Erro no logout:", error);
        await showAlert("Erro", "Ocorreu um erro ao tentar sair da conta.");
    }
}
