// RESPONSABILIDADE: Interagir com Firebase Authentication e notificar a aplicação sobre mudanças de login.

import { auth, provider } from './vitrini-firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showAlert } from './vitrini-utils.js';

/**
 * Configura o listener para mudanças no estado de autenticação (login/logout)
 * @param {Function} callback - função que recebe o usuário logado ou null
 */
export function setupAuthListener(callback) {
    onAuthStateChanged(auth, (user) => {
        if (callback && typeof callback === 'function') {
            callback(user);
        }
    });
}

/**
 * Faz login com popup do Google e garante persistência local
 */
export async function fazerLogin() {
    try {
        // Garante que o usuário permanecerá logado mesmo após fechar o navegador
        await setPersistence(auth, browserLocalPersistence);

        // Login com popup
        await signInWithPopup(auth, provider);

        // O listener 'onAuthStateChanged' atualiza automaticamente a UI

    } catch (error) {
        console.error("Erro no login:", error.message);
        // Ignora erro de popup fechado pelo usuário
        if (error.code !== 'auth/popup-closed-by-user') {
            await showAlert("Erro no Login", "Não foi possível fazer o login. Por favor, tente novamente.");
        }
    }
}

/**
 * Faz logout do usuário
 */
export async function fazerLogout() {
    try {
        await signOut(auth);
        // O listener 'onAuthStateChanged' atualiza automaticamente a UI
    } catch (error) {
        console.error("Erro no logout:", error);
        await showAlert("Erro", "Ocorreu um erro ao tentar sair da conta.");
    }
}
