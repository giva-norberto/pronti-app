// Usamos a URL completa do Firebase para garantir que o navegador encontre o código
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // Corrigi para o padrão .appspot.com, que é mais comum.
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

const app = initializeApp(firebaseConfig);

export { app };