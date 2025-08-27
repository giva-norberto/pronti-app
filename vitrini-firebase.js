// RESPONSABILIDADE: Criar e exportar as instâncias do Firebase, garantindo persistência de login multiempresa.

// 1. Importa os módulos necessários do Firebase
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===================================================================
//                    ATENÇÃO: CONFIG MULTIEMPRESA
// ===================================================================
// 2. Configuração do seu projeto Firebase (ATUALIZADA COM A CHAVE CORRETA )
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};
// ===================================================================

// 3. Inicializa as instâncias do Firebase (previne duplicidade)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);

// 4. Garante que o usuário permaneça logado entre páginas/tabs
setPersistence(auth, browserLocalPersistence).catch((error) => {
  // Opcional: trate ou logue erros se desejar
  console.error("Erro ao definir persistência do Auth:", error);
});

/*
  DOCUMENTAÇÃO:
  - Importe este módulo em todos os arquivos que dependem de autenticação, Firestore ou provider Google.
  - O bloco setPersistence(auth, browserLocalPersistence) garante que o login do usuário não se perca ao navegar ou recarregar a página.
  - Para logout: import { signOut } from "firebase/auth"; signOut(auth);

  MULTIEMPRESA:
  - NÃO é necessário alterar nada neste arquivo para multiempresa.
  - O contexto multiempresa é controlado nos módulos que consomem Firestore/Auth/Storage,
    sempre usando o empresaId correto nas queries/paths de dados.
  - Este arquivo é universal, central, seguro e não depende do contexto atual de empresa do usuário.
*/
