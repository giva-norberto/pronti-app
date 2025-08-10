// Importação dos módulos do Firebase via CDN (ES Modules)
// firebase-config.js - Revisado e pronto para Firebase v10 CDN ES Modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Configuração pública do seu projeto Firebase
// Configuração do seu projeto Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
@@ -14,10 +15,10 @@ export const firebaseConfig = {
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicialização do Firebase App
// Inicializa o Firebase App
export const app = initializeApp(firebaseConfig);

// Instâncias dos serviços
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
// Exporta instâncias dos serviços - ESSENCIAL para uso correto nos outros arquivos!
export const db = getFirestore(app);      // Firestore precisa do app como argumento!
export const auth = getAuth(app);         // Auth precisa do app como argumento!
export const storage = getStorage(app);   // Storage precisa do app como argumento!
