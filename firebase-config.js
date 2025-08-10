// firebase-config.js - Revisado para Firebase v10+ CDN ES Modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase App apenas uma vez!
const app = initializeApp(firebaseConfig);

// Exporta instâncias dos serviços (Firestore, Auth, Storage)
export const db = getFirestore(app);      // Firestore precisa do app como argumento!
export const auth = getAuth(app);         // Auth precisa do app como argumento!
export const storage = getStorage(app);   // Storage precisa do app como argumento!
