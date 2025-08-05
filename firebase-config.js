// firebase-config.js (VERSÃO CORRIGIDA E ANTI-ERRO)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // ✅ CORRIGIDO AQUI
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// --- LÓGICA ANTI-DUPLICAÇÃO ---
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
// --- FIM DA LÓGICA ---
export const app = firebaseApp;
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("🔥 Firebase inicializado com sucesso e pronto a ser usado!");
