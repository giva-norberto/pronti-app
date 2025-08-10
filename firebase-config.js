// firebase-config.js - Corrigido com as informações do painel e práticas de segurança

// Importação dos módulos do Firebase via CDN (ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ======================================================================
//      CONFIGURAÇÃO CORRIGIDA - Valores do seu painel Firebase
// ======================================================================
export const firebaseConfig = {
  // PRÁTICA DE SEGURANÇA: Para não enviar a chave ao GitHub,
  // o ideal é usar Variáveis de Ambiente.
  // Ex: apiKey: import.meta.env.VITE_FIREBASE_API_KEY
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us", // <-- Chave de API da Web CORRETA

  // O ID do projeto estava com 'tt' em vez de 't'. Este é o valor correto.
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase App
export const app = initializeApp(firebaseConfig);

// Exporta instâncias dos serviços para uso em outros arquivos
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
