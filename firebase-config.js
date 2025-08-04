// firebase-config.js (VERSÃO CORRIGIDA E FINAL)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js"; // Adicionamos o Storage aqui

const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// ==================================================================
// BLOCO DE CORREÇÃO: LÓGICA ANTI-DUPLICAÇÃO
// ==================================================================
// Esta lógica garante que o Firebase seja inicializado apenas UMA VEZ.
let app;
if (!getApps().length) {
  // Se nenhum app Firebase foi inicializado ainda, inicializa.
  app = initializeApp(firebaseConfig);
} else {
  // Se já existir um, simplesmente pega a instância que já está rodando.
  app = getApps()[0];
}
// ==================================================================

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Adicionamos a inicialização do Storage

// Exportamos todos os serviços necessários para os outros arquivos
export { app, db, auth, storage };
