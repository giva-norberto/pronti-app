// firebase-config.js (VERSÃO CORRIGIDA)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Função para inicializar e obter o app Firebase de forma segura
const initializeFirebaseApp = ( ) => {
  const apps = getApps();
  if (apps.length) {
    return getApp(); // Retorna o app já inicializado
  }
  return initializeApp(firebaseConfig); // Inicializa o app se não existir
};

// Inicializa e exporta o app
const app = initializeFirebaseApp();

// Inicializa e exporta os serviços
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Exporta os objetos para usar nos outros scripts
export { app, db, auth, storage };
