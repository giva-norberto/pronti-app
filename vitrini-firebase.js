// ======================================================================
// ARQUIVO: firebase-config-vitrine.js
// RESPONSABILIDADE: Ser o PONTO DE ENTRADA do Firebase para a VITRINE.
// ======================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
// [REVISADO] Adicionado 'GoogleAuthProvider' para permitir o login com Google.
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Configuração do Firebase específica para a Vitrine.
// [VALIDADO] Usando a chave de API que você designou para o app público.
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8", // Chave do app público
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

/**
 * Garante que o app Firebase da vitrine seja inicializado apenas uma vez.
 * Usar um nome ("vitrineApp") evita conflitos se o painel de admin
 * for aberto na mesma sessão do navegador.
 * @returns {FirebaseApp} A instância do aplicativo Firebase da vitrine.
 */
const getFirebaseApp = () => {
    const existingApp = getApps().find(app => app.name === 'vitrineApp');
    if (existingApp) {
        return existingApp;
    }
    // Se não existir, inicializa uma nova com esse nome
    return initializeApp(firebaseConfig, 'vitrineApp');
};

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const app = getFirebaseApp();
const auth = getAuth(app);
const db = getFirestore(app, "pronti-app"); // Conecta ao banco de dados correto

// [CORREÇÃO] O Provedor de Autenticação do Google é instanciado aqui.
const provider = new GoogleAuthProvider();

// --- EXPORTAÇÕES ---
// [REVISADO] Exporta as instâncias para uso da vitrine, incluindo o 'provider'.
export { app, db, auth, provider };

