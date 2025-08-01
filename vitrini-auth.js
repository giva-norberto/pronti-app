// vitrini-auth.js (VERSÃO FINAL)

import { auth, provider, onAuthStateChanged, signInWithPopup, signOut } from './vitrini-firebase.js';
import { showAlert } from './vitrini-utils.js';

export let currentUser = null;

export function initializeAuth(callback) {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (callback && typeof callback === 'function') {
            callback(user);
        }
    });
}

export async function fazerLogin() {
    try {
        await signInWithPopup(auth, provider);
        // Não precisa de alerta de sucesso, a página irá recarregar e mostrar o estado de logado.
    } catch (error) {
        console.error("Erro no login:", error.message);
        await showAlert("Erro no Login", "Não foi possível fazer o login. Por favor, tente novamente.");
    }
}

export async function fazerLogout() {
    try {
        await signOut(auth);
        await showAlert("Até logo!", "Você saiu da sua conta com sucesso.");
    } catch (error) {
        console.error("Erro no logout:", error);
        await showAlert("Erro", "Ocorreu um erro ao tentar sair da conta.");
    }
}
