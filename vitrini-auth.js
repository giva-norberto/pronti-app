// vitrini-auth.js
import { auth, provider } from './vitrini-firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { showNotification } from './vitrini-utils.js';

export let currentUser = null;

export function iniciarAuthListener(atualizarUIparaUsuario) {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        atualizarUIparaUsuario(user);
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
