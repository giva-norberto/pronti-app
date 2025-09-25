// CORREÇÃO: Usando a versão compat (compatível) para Service Workers
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// SUAS CREDENCIAIS DO FIREBASE
// Elas já estão corretas aqui.
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // CORREÇÃO: removido "firebasestorage." do início
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase no formato compatível
firebase.initializeApp(firebaseConfig);

// Obtém a instância do Messaging para lidar com mensagens em segundo plano
const messaging = firebase.messaging();

// O Service Worker não precisa de mais nada aqui por enquanto.
// O Firebase gerencia o resto em segundo plano.
