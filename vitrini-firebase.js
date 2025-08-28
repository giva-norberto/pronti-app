// ======================================================================
//   VITRINI - FIREBASE-CONFIG.JS (PARA A PÁGINA DA VITRINE)
// RESPONSABILIDADE: Criar e exportar as instâncias do Firebase.
// ======================================================================

// 1. Importa os módulos necessários da versão mais recente do Firebase
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// 2. Configuração do seu projeto Firebase (usando a chave do app "ProntiIA" )
const firebaseConfig = {
  // CORREÇÃO 1: Usando a chave de API correta para este app.
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// 3. Função segura para inicializar o Firebase (padrão Singleton)
//    Garante que o app seja inicializado apenas uma vez, mesmo se o script for importado várias vezes.
const getFirebaseApp = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

// 4. Obtém a instância única do app e inicializa os serviços
const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// CORREÇÃO 2: Especifica o nome do banco de dados para se conectar.
const db = getFirestore(app, "pronti-app");

// 5. Garante que a sessão do usuário persista (se ele fizer login na vitrine)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Erro ao definir persistência do Auth:", error);
});

// 6. Exporta tudo para ser usado pelos scripts da vitrine
export { app, db, auth, storage, provider };
