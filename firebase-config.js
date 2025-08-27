// RESPONSABILIDADE: Criar e exportar as instâncias do Firebase, garantindo persistência de login.

// 1. Importa os módulos necessários do Firebase
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===================================================================
//      CONFIGURAÇÃO ATUALIZADA - APONTANDO PARA O NOVO PROJETO
// ===================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBIT61ii28vbYyi5oNRDRy8vNx3U4XDVfo",
  authDomain: "pronti-novo.firebaseapp.com",
  projectId: "pronti-novo",
  storageBucket: "pronti-novo.appspot.com", // Corrigido para o novo projeto
  messagingSenderId: "315046501183",
  appId: "1:315046501183:web:2f188bfd00b448aa64518a"
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
  console.error("Erro ao definir persistência do Auth:", error);
});

/*
  DOCUMENTAÇÃO:
  - Este módulo deve ser importado em todos os arquivos que dependem de autenticação, Firestore ou provider Google.
  - O bloco setPersistence(auth, browserLocalPersistence) garante que o login do usuário não se perca ao navegar ou recarregar a página.
  - Se precisar de logout, use: import { signOut } from "firebase/auth"; signOut(auth);

  MULTIEMPRESA:
  - NÃO é necessário alterar nada neste arquivo para multiempresa.
  - O contexto multiempresa é controlado pelos módulos que consomem Firestore/Auth/Storage, 
    sempre passando o empresaId correto. Mantenha este arquivo central e universal.
*/
