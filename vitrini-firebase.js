// vitrini-firebase.js
// VERSÃO FINAL COM A API KEY CORRETA

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Configuração final e correta do seu projeto Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us", // <-- A CHAVE CORRETA
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  // App ID pego de uma configuração anterior, verifique se ainda é o mesmo
  appId: "1:736700619274:web:557aa247905e56fa7e5df3" 
};

// Inicializa e exporta as instâncias principais
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
