// ======================================================================
// ARQUIVO: firebase-config-vitrine.js
// RESPONSABILIDADE: Ser o PONTO DE ENTRADA do Firebase para a VITRINE.
// [REVISADO] - Único ponto de inicialização, seguro para uso em múltiplos lugares.
// ======================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- CONFIGURAÇÃO PÚBLICA DO FIREBASE (VALIDADA) ---
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

/**
 * Inicializa (ou recupera) uma instância nomeada do Firebase exclusiva para a vitrine.
 * Evita conflitos caso outro app Firebase esteja carregado na mesma página/sessão.
 * @returns {FirebaseApp}
 */
function getFirebaseApp() {
  const apps = getApps();
  const app = apps.find(app => app.name === 'vitrineApp');
  if (app) return app;
  return initializeApp(firebaseConfig, 'vitrineApp');
}

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const app = getFirebaseApp();
const auth = getAuth(app);
const db = getFirestore(app); // Usa padrão do projeto, não precisa nome extra.
const provider = new GoogleAuthProvider();

// --- EXPORTAÇÕES ---
export { app, db, auth, provider };
