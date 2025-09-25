// ======================================================================
//               ARQUIVO firebase-messaging-sw.js  (CORRIGIDO)
// ======================================================================
// Service Worker para receber notificações em segundo plano via FCM.

// Importa as bibliotecas do Firebase (versão modular 10.13.2)
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js');

// Configuração do seu projeto Firebase
firebase.initializeApp({
  apiKey: "AIzaSyC9aewvqMIfAcXeKH0Y8KMn3-clYL4GTv0",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

// Inicializa o serviço de mensagens
const messaging = firebase.messaging();

// (Opcional) Handler para mensagens recebidas em segundo plano
// messaging.onBackgroundMessage((payload) => {
//   console.log('[firebase-messaging-sw.js] Mensagem em background:', payload);
//   // Aqui você pode exibir uma notification personalizada:
//   // self.registration.showNotification(payload.notification.title, {...payload.notification});
// });
