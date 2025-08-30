// ======================================================================
// ARQUIVO: firebase-config-vitrine.js
// RESPONSABILIDADE: Ser o PONTO DE ENTRADA do Firebase para a VITRINE.
// [VALIDADO] - Este arquivo está completo e correto.
// ======================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- CONFIGURAÇÃO PÚBLICA DO FIREBASE (VALIDADA) ---
const firebaseConfig = {
  // Chave de API da Web para o app público (vitrine).
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",

  // Domínio de autenticação, derivado do ID do projeto.
  authDomain: "pronti-app-37c6e.firebaseapp.com",

  // ID do seu projeto no Firebase.
  projectId: "pronti-app-37c6e",

  // Local de armazenamento de arquivos (Storage).
  storageBucket: "pronti-app-37c6e.appspot.com",

  // ID do remetente de mensagens.
  messagingSenderId: "736700619274",

  // ID do seu aplicativo Web específico da vitrine no projeto.
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
const db = getFirestore(app, "pronti-app"); // Conecta ao banco de dados nomeado "pronti-app".
const provider = new GoogleAuthProvider(); // Cria o provedor de login com Google.

// --- EXPORTAÇÕES ---
// Exporta as instâncias para uso exclusivo da vitrine.
export { app, db, auth, provider };
