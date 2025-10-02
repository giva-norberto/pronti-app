// ======================================================================
// ARQUIVO: firebase-config.js (VERSÃO ORIGINAL RESTAURADA)
// =====================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// Configuração do seu projeto Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // Padrão que funciona
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Sua função Singleton original. Garante que o app seja inicializado apenas uma vez.
const getFirebaseApp = ( ) => {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
};

// Inicializa e exporta tudo a partir da instância única
const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

// Conecta ao banco de dados
const db = getFirestore(app);

// Define a persistência do login
setPersistence(auth, browserLocalPersistence);

// Exporta as instâncias para serem usadas em outros arquivos
export { app, db, auth, storage, provider };
;
