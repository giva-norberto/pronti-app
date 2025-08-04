// firebase-config.js (VERSÃO FINAL E COMPLETA)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"; // <-- ADICIONADO

const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Inicializa e exporta todos os serviços que a aplicação precisa
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // <-- ADICIONADO

export { app, db, auth, storage }; // <-- ADICIONADO 'storage'
