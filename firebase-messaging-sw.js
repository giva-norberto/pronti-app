// ======================================================================
//               ARQUIVO firebase-messaging-sw.js  (FUNCIONAL CORRIGIDO)
// ======================================================================
// Service Worker para receber notificações em segundo plano via FCM.

// Importa as bibliotecas compatíveis do Firebase (v10 via compat para SW)
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// ======================================================================
// Configuração do seu projeto Firebase
// ATENÇÃO: a apiKey deve ser exatamente a mesma do firebase-config.js
// ======================================================================
firebase.initializeApp({
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

// ======================================================================
// Inicializa o serviço de mensagens
// ======================================================================
const messaging = firebase.messaging();

// ======================================================================
// Handler para mensagens recebidas em segundo plano (API nova v10)
// ======================================================================
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Mensagem em background recebida:', payload);

  const notificationTitle = payload.notification?.title || 'Nova notificação';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icon.png',
    image: payload.notification?.image || undefined
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ======================================================================
// (Opcional) Listener de clique na notificação
// ======================================================================
self.addEventListener('notificationclick', function (event) {
  console.log('[firebase-messaging-sw.js] Notificação clicada:', event.notification);
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://prontiapp.com.br/')
  );
});
