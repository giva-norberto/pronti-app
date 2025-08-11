// firebase-config.js - Arquivo de teste com chaves diretas para diagnóstico

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ======================================================================
//      CONFIGURAÇÃO DIRETA PARA TESTE DE DEPLOY
// ======================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us", // A chave CORRETA
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase App
export const app = initializeApp(firebaseConfig);

// Exporta instâncias dos serviços
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
