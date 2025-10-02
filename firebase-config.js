// ======================================================================
// ARQUIVO: firebase-config.js (VERSÃO FINAL, CORRIGIDA E SEGURA)
// =====================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// Configuração do seu projeto Firebase (sem alterações ).
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // Usando o padrão que funciona
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// ======================================================================
//           ✨ LÓGICA DE ISOLAMENTO APLICADA AQUI ✨
// ======================================================================

// 1. Função que decide qual "bolha" de sessão usar.
const getAppName = () => {
  const pathname = window.location.pathname;
  // Se a URL for da vitrine ou do redirecionador, usa a sessão 'vitrineCliente'.
  const isVitrine = pathname.includes('/vitrine.html') || pathname.includes('/r.html');
  return isVitrine ? 'vitrineCliente' : 'painelDono';
};

// 2. Sua função Singleton, adaptada para usar a "bolha" correta.
const getFirebaseApp = () => {
  const appName = getAppName();
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return existingApp;
  }
  // Se não existir, cria uma nova com o nome correto.
  return initializeApp(firebaseConfig, appName);
};

// ======================================================================
// O RESTANTE DO SEU ARQUIVO PERMANECE 100% IDÊNTICO
// ======================================================================

// Inicializa e exporta tudo a partir da instância única e correta
const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

// Conecta ao banco de dados. O segundo argumento não é mais necessário nas versões recentes.
const db = getFirestore(app);

// ✅ SUA LINHA CRUCIAL, AGORA APLICADA À INSTÂNCIA CORRETA
setPersistence(auth, browserLocalPersistence);

// Exporta as instâncias para serem usadas em outros arquivos
export { app, db, auth, storage, provider };
