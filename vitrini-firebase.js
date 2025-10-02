// ======================================================================
// ARQUIVO: vitrini-firebase.js (VITRINE - VERSÃO COM A CHAVE CORRETA)
// =====================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// ✅ SUA CONFIGURAÇÃO FINAL E CORRETA
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4", // A CHAVE QUE VOCÊ FORNECEU
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Função Singleton para a vitrine.
const getFirebaseApp = ( ) => {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
};

// O resto do código, 100% preservado.
const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence);

export { app, db, auth, storage, provider };
