// ======================================================================
// ARQUIVO: firebase-config.js (VERSÃO INTELIGENTE E SEGURA)
// =====================================================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// ✅ 1. SUA CONFIGURAÇÃO 100% CORRETA E VALIDADA
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// ======================================================================
//           ✨ A LÓGICA "COMPLEXA" REVISITADA E CORRIGIDA ✨
// ======================================================================

// 2. O "Detetive": Decide qual "bolha" de sessão usar baseado na URL.
const getAppName = ( ) => {
  const pathname = window.location.pathname;
  
  // Condições que identificam a vitrine.
  const isVitrine = pathname.includes('/vitrine.html') || pathname.includes('/r.html');

  if (isVitrine) {
    console.log("[Firebase Config] Contexto: VITRINE. Usando sessão 'vitrineCliente'.");
    return 'vitrineCliente';
  } else {
    console.log("[Firebase Config] Contexto: PAINEL. Usando sessão 'painelDono'.");
    return 'painelDono';
  }
};

// 3. Sua função Singleton, agora adaptada para usar a "bolha" correta.
const getFirebaseApp = () => {
  const appName = getAppName();
  
  // Procura por uma instância JÁ CRIADA com esse nome específico.
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return existingApp; // Se já existe, retorna ela.
  }
  
  // Se não existir, cria uma nova com o nome correto.
  return initializeApp(firebaseConfig, appName);
};

// ======================================================================
// O RESTANTE DO SEU CÓDIGO ORIGINAL, 100% PRESERVADO
// ======================================================================

const app = getFirebaseApp();
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

// ✅ SUA INICIALIZAÇÃO DO BANCO DE DADOS, 100% PRESERVADA
const db = getFirestore(app, "pronti-app");

setPersistence(auth, browserLocalPersistence);

// ✅ OS EXPORTS SÃO OS MESMOS, NADA QUEBRA NOS OUTROS ARQUIVOS
export { app, db, auth, storage, provider };
