// Arquivo: firebase-config.js (do PAINEL - VERSÃO FINAL E CORRIGIDA)

// ✅ ALTERAÇÃO 1: Importa 'getApp' para buscar a instância pelo nome.
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8", // Sua config do painel
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// ✅ ALTERAÇÃO 2: Damos um nome único e exclusivo para a sessão do painel.
const NOME_SESSAO_PAINEL = "painelDono";

// ✅ ALTERAÇÃO 3: A lógica de inicialização agora busca a instância pelo nome.
let app;
try {
  // Tenta obter a sessão do painel que já pode ter sido criada.
  app = getApp(NOME_SESSAO_PAINEL );
} catch (e) {
  // Se não existir, cria uma nova sessão que SÓ o painel vai usar.
  app = initializeApp(firebaseConfig, NOME_SESSAO_PAINEL);
}

// O resto do arquivo permanece idêntico.
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// A exportação permanece a mesma, nada quebra nos outros arquivos.
export { app, db, auth, provider };
