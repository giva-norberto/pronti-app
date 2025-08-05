// firebase-config.js (VERSÃO MAIS ROBUSTA)

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

// Inicializa o app de forma segura e já o exporta.
// Se não houver apps, inicializa um novo. Se já houver, pega o existente.
export const app = getApps( ).length ? getApp() : initializeApp(firebaseConfig);

// Exporta os serviços diretamente, usando a constante 'app' que acabamos de criar.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
