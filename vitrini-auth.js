// vitrini-auth.js

// Importa apenas o que é necessário do nosso módulo central do Firebase
import { auth, provider, onAuthStateChanged, signInWithPopup, signOut } from './vitrini-firebase.js';
import { showNotification } from './vitrini-utils.js';

export let currentUser = null;

// CORREÇÃO: A função foi renomeada para 'initializeAuth' para corresponder ao que o 'vitrine.js' está importando.
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
        showNotification("Login realizado com sucesso!");
    } catch (error) {
        console.error("Erro no login:", error);
        showNotification("Erro ao fazer login.", true);
    }
}

export async function fazerLogout() {
    try {
        await signOut(auth);
        showNotification("Você saiu da sua conta.");
    } catch (error) {
        console.error("Erro no logout:", error);
    }
}
