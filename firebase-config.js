// firebase-config.js - Sempre usando a última versão do Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/latest/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/latest/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/latest/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/latest/firebase-storage.js";

// Configuração direta para teste
export const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
