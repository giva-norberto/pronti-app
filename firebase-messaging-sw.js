// ======================================================================
// 	 	 	 ARQUIVO firebase-messaging-sw.js (VERSÃO CORRETA E SEGURA)
// ======================================================================

// Este código usa 'importScripts' que é a forma correta de carregar
// as bibliotecas do Firebase dentro de um Service Worker.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js' );
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js' );

// Suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC9aewvqMIfAcXeKH0Y8KMn3-clYL4GTv0",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase para que o serviço de mensagens possa funcionar
firebase.initializeApp(firebaseConfig);

// Obtém a instância do serviço de Mensagens
const messaging = firebase.messaging();

// O arquivo agora está pronto para receber notificações em segundo plano.
ra receber notificações em segundo plano.
