// vitrini-firebase.js
// RESPONSABILIDADE ÚNICA: Inicializar e exportar as instâncias centrais do Firebase.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// A sua configuração do Firebase.
// VERIFIQUE SE ESTES VALORES ESTÃO 100% CORRETOS, POIS ELES ERAM A CAUSA DO ERRO DE LOGIN ANTERIOR.
const firebaseConfig = {
    apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
    authDomain: "pronti-app-37c6e.firebaseapp.com",
    projectId: "pronti-app-37c6e",
    storageBucket: "pronti-app-37c6e.appspot.com",
    messagingSenderId: "736700619274",
    appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa e exporta as instâncias principais
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// A variável 'provider' é declarada e exportada AQUI e SOMENTE AQUI.
export const provider = new GoogleAuthProvider();
