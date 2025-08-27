// Firebase config para pronti-app (projeto antigo)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ATENÇÃO: storageBucket corrigido para .appspot.com
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase APENAS UMA VEZ
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Instâncias únicas
export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);

// Persistência local para Auth (opcional, mas recomendado)
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);

// Garante que a persistência de login será local (mesmo após fechar o navegador)
setPersistence(auth, browserLocalPersistence).catch(() => {});
