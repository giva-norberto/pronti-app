// ======================================================================
// FIREBASE-CONFIG.JS (VERSÃO FINAL E ROBUSTA - ANTI-DUPLICIDADE)
// ======================================================================

// 1. Importa os módulos necessários do Firebase
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// 2. Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// ======================= A CORREÇÃO ESTÁ AQUI =======================
// 3. Função para inicializar o Firebase de forma segura (Singleton Pattern )
//    Esta função garante que o app seja inicializado apenas UMA VEZ.
const getFirebaseApp = () => {
  if (getApps().length === 0) {
    // Se nenhum app foi inicializado, cria um novo.
    return initializeApp(firebaseConfig);
  } else {
    // Se já existe um app, simplesmente o retorna.
    return getApp();
  }
};

// 4. Inicializa e exporta as instâncias dos serviços
const app = getFirebaseApp();
const auth = getAuth(app);

// Especifica o nome do banco de dados, como fizemos anteriormente.
const db = getFirestore(app, "pronti-app"); 

const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// 5. Garante que o usuário permaneça logado entre páginas/tabs
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Erro ao definir persistência do Auth:", error);
});

// 6. Exporta tudo para ser usado em outros arquivos
export { app, db, auth, storage, provider };
