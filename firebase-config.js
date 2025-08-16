import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Configuração do Firebase do seu projeto
export const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us", 
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app", // <-- Corrigido aqui!
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicialização dos serviços do Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);      // Firestore (banco de dados)
export const auth = getAuth(app);         // Autenticação
export const storage = getStorage(app);   // Storage (arquivos)

// --- GARANTE QUE O USUÁRIO SE MANTÉM LOGADO ENTRE AS PÁGINAS ---
setPersistence(auth, browserLocalPersistence).catch(console.error);
