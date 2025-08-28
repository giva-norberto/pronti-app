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
  // A chave de API que você está usando no seu código original.
  // Se o erro persistir, verifique se esta é a chave correta para o app "ProntiIA-v2" ou o que estiver usando na vitrine.
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
  // getApps() retorna um array com as apps já inicializadas.
  // Se o array não estiver vazio, significa que já temos uma instância.
  if (getApps().length > 0) {
    return getApp(); // Retorna a instância já existente.
  }
  // Se o array estiver vazio, inicializa uma nova instância.
  return initializeApp(firebaseConfig);
};

// 4. Obtém a instância única do app e inicializa os serviços
const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Lembre-se da correção para o seu banco de dados nomeado "pronti-app"
const db = getFirestore(app, "pronti-app");

// 5. Garante que o usuário permaneça logado entre páginas/tabs
//    É importante chamar isso apenas uma vez, o que nosso padrão garante.
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistência do Auth definida com sucesso.");
  })
  .catch((error) => {
    console.error("Erro ao definir persistência do Auth:", error);
  });

// 6. Exporta tudo para ser usado em outros arquivos
export { app, db, auth, storage, provider };
