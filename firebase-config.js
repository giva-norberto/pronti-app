// RESPONSABILIDADE: Criar e exportar as instâncias do Firebase, garantindo persistência de login.

// 1. Importa os módulos necessários do Firebase
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// 2. Configuração do seu projeto Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // CORRETO!
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// 3. Inicializa as instâncias do Firebase (previne duplicidade)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export { app };
export const db = getFirestore(app);      // Firestore (banco de dados)
export const auth = getAuth(app);         // Autenticação
export const storage = getStorage(app);   // Storage (arquivos)

// 4. Garante que o usuário permaneça logado entre páginas/tabs
setPersistence(auth, browserLocalPersistence).catch((error) => {
  // Opcional: você pode tratar/logar erros aqui se desejar
  console.error("Erro ao definir persistência do Auth:", error);
});

/*
  DOCUMENTAÇÃO:
  - Este módulo deve ser importado em todos os arquivos que dependem de autenticação, Firestore ou Storage.
  - O bloco setPersistence(auth, browserLocalPersistence) garante que o login do usuário não se perca ao navegar ou recarregar a página.
  - Para logout: import { signOut } from "firebase/auth"; signOut(auth);
*/
