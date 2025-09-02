// ======================================================================
// ARQUIVO: firebase-config.js (VERSÃO ÚNICA E CENTRAL)
// ======================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// Configuração do seu projeto Firebase. Use esta em todo o app.
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Função Singleton: Garante que o app seja inicializado apenas uma vez.
const getFirebaseApp = () => {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
};

// Inicializa e exporta tudo a partir da instância única
const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// (Voltou) Conecta ao banco de dados com nome "pronti-app"
const db = getFirestore(app, "pronti-app");

// Define a persistência do login
setPersistence(auth, browserLocalPersistence);

// Exporta as instâncias para serem usadas em outros arquivos
export { app, db, auth, storage, provider };
