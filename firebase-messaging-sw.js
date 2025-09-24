// CORREÇÃO: Usando a versão 10.13.2 e a sintaxe moderna (import)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// SUAS CREDENCIAIS DO FIREBASE VÃO AQUI
// É importante que sejam as mesmas do seu arquivo firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// O Service Worker não precisa de mais nada aqui por enquanto.
// O Firebase gerencia o resto em segundo plano.
