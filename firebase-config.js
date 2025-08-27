// RESPONSABILIDADE: Criar e exportar as instâncias do Firebase, garantindo persistência de login.

// 1. Importa os módulos necessários do Firebase
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===================================================================
//        CONFIGURAÇÃO FINAL - GERADA PELO NOVO APP (ProntiIA-v2 )
// ===================================================================
// 2. Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // Corrigido para o padrão correto
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:b1f96678a0c3e9d47e5df3" // <-- O NOVO App ID
};
// ===================================================================


// 3. Inicializa as instâncias do Firebase (previne duplicidade)
// (Vou incluir a exportação do provider que estava no seu outro arquivo para garantir consistência)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider(); // Garantindo que o provider do Google continue aqui
export const storage = getStorage(app);

// 4. Garante que o usuário permaneça logado entre páginas/tabs
setPersistence(auth, browserLocalPersistence).catch((error) => {
  // Opcional: você pode tratar/logar erros aqui se desejar
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
