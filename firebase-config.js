// RESPONSABILIDADE: Criar e exportar as instâncias ÚNICAS do Firebase.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIT61ii28vbYyi5oNRDRy8vNx3U4XDVfo",
  authDomain: "pronti-novo.firebaseapp.com",
  projectId: "pronti-novo",
  storageBucket: "pronti-novo.appspot.com",
  messagingSenderId: "315046501183",
  appId: "1:315046501183:web:2f188bfd00b448aa64518a"
};

// Inicializa o Firebase APENAS UMA VEZ
const app = !getApps( ).length ? initializeApp(firebaseConfig) : getApps()[0];

// Exporta as instâncias ÚNICAS para todo o aplicativo usar
export const db = getFirestore(app);
export const auth = getAuth(app); // <--- Instância ÚNICA de auth
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);
