// ======================================================================
// FIREBASE-CONFIG.JS (VERSÃO CORRIGIDA)
// ======================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// Sua configuração do Firebase para pronti-app-37c6e
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase
export const app = initializeApp(firebaseConfig );

// ======================= A CORREÇÃO ESTÁ AQUI =======================
// Especifica o nome do seu banco de dados ("pronti-app") ao inicializar o Firestore.
export const db = getFirestore(app, "pronti-app");
// ====================================================================

export const auth = getAuth(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();
