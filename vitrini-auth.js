// vitrini-auth.js
// RESPONSABILIDADE: Interagir com o Firebase Authentication e
// notificar a aplicação sobre mudanças no estado de login.
// Este módulo não guarda estado.

import { auth, provider } from './vitrini-firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showAlert } from './vitrini-utils.js'; // Assumindo que showAlert vem de utils

/**
 * Configura o listener que observa mudanças no estado de autenticação (login/logout).
 * Quando uma mudança ocorre, ele executa a função de callback passada.
 * @param {Function} callback - A função a ser executada quando o estado de auth mudar.
 * Ela receberá o objeto 'user' (ou null) como argumento.
 */
export function setupAuthListener(callback) {
    onAuthStateChanged(auth, (user) => {
        // Apenas chama o callback. A responsabilidade de gerenciar o estado
        // é do módulo que chamou esta função (no nosso caso, vitrine.js).
        if (callback && typeof callback === 'function') {
            callback(user);
        }
    });
}

/**
 * Inicia o processo de login com o popup do Google.
 */
export async function fazerLogin() {
    try {
        await signInWithPopup(auth, provider);
        // O listener 'onAuthStateChanged' cuidará de atualizar a UI automaticamente.
        // Não é necessário alerta de sucesso aqui para não ser intrusivo.
    } catch (error) {
        console.error("Erro no login:", error.message);
        // Apenas mostramos alerta em caso de erro.
        await showAlert("Erro no Login", "Não foi possível fazer o login. Por favor, tente novamente.");
    }
}

/**
 * Inicia o processo de logout do usuário.
 */
export async function fazerLogout() {
    try {
        await signOut(auth);
        // Opcional: pode-se mostrar uma notificação de sucesso.
        // await showAlert("Até logo!", "Você saiu da sua conta com sucesso.");
        // O listener 'onAuthStateChanged' também cuidará de atualizar a UI.
    } catch (error) {
        console.error("Erro no logout:", error);
        await showAlert("Erro", "Ocorreu um erro ao tentar sair da conta.");
    }
}
