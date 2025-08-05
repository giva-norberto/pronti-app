// firebase-config.js (VERSÃO FINAL CORRIGIDA)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Importa a função principal do seu perfil.
import { inicializarPerfil } from './perfil.js';

const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// CORREÇÃO PRINCIPAL: Espera o HTML carregar completamente ANTES de fazer qualquer coisa.
window.addEventListener('DOMContentLoaded', ( ) => {
  
  // Agora, com o HTML pronto, podemos inicializar o Firebase com segurança.
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);

  // E finalmente, chamar a função que inicia a lógica da página de perfil.
  inicializarPerfil({ auth, db, storage });

});
