// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// SUA CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBIT61ii28vbYyi5oNRDRy8vNx3U4XDVfo",
  authDomain: "pronti-novo.firebaseapp.com",
  projectId: "pronti-novo",
  storageBucket: "pronti-novo.appspot.com", // CORRIGIDO: .app -> .app**spot**.com
  messagingSenderId: "315046501183",
  appId: "1:315046501183:web:2f188bfd00b448aa64518a"
};

// Inicializa o Firebase e exporta instâncias SEMPRE DA MESMA VERSÃO!
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
