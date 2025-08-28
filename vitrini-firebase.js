// ======================================================================
// ARQUIVO: firebase-config-vitrine.js (NOME SUGERIDO)
// RESPONSABILIDADE: Ser o PONTO DE ENTRADA ÚNICO do Firebase para a vitrine.
// ======================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
// Importe outros módulos do Auth/Storage se a vitrine precisar deles.
// Se a vitrine for apenas de leitura, eles podem até ser removidos.
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Configuração do Firebase específica para a Vitrine.
// Use a chave de API que você designou para o app público.
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8", // Chave do app público
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Função Singleton para garantir inicialização única
const getFirebaseApp = ( ) => {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
};

// Inicializa e exporta as instâncias para uso EXCLUSIVO da vitrine
const app = getFirebaseApp();
const auth = getAuth(app);
const db = getFirestore(app, "pronti-app"); // Conecta ao banco de dados correto

export { app, db, auth };

