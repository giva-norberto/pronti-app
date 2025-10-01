import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// --- INÍCIO DA MUDANÇA SEGURA ---

// 1. Damos um nome único para a sessão da vitrine.
const NOME_SESSAO_VITRINE = "vitrineCliente";

// 2. Esta nova lógica garante que a vitrine SEMPRE use sua própria sessão.
let app;
try {
  // Tenta obter a sessão da vitrine, caso a página tenha recarregado.
  app = getApp(NOME_SESSAO_VITRINE );
} catch (e) {
  // Se não existir, cria uma nova sessão que SÓ a vitrine vai usar.
  app = initializeApp(firebaseConfig, NOME_SESSAO_VITRINE);
}

// --- FIM DA MUDANÇA SEGURA ---

const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// A linha de exportação é exatamente a mesma de antes.
export { app, db, auth, provider };
