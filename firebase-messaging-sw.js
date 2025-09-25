// ======================================================================
//               ARQUIVO firebase-messaging-sw.js  (FUNCIONAL CORRIGIDO)
// ======================================================================
// Service Worker para receber notificações em segundo plano via FCM.

// Importa as bibliotecas compatíveis do Firebase (v10 via compat para SW)
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// ======================================================================
// Configuração do seu projeto Firebase
// ATENÇÃO: A apiKey DEVE SER EXATAMENTE A MESMA DO firebase-config.js!
// ======================================================================
firebase.initializeApp({
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us", // CORRIGIDO! (deve ser igual ao app principal)
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
// Handler para mensagens recebidas em segundo plano
// ======================================================================
messaging.setBackgroundMessageHandler(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensagem em background recebida:', payload);

  // Extrai dados da mensagem ou usa defaults
  const notificationTitle = payload.data?.title || 'Nova notificação';
  const notificationOptions = {
    body: payload.data?.body || '',
    icon: payload.data?.icon || '/icon.png',
    image: payload.data?.image || undefined
  };

  // Exibe a notificação
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ======================================================================
// (Opcional) Listener de clique na notificação
// ======================================================================
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notificação clicada:', event.notification);
  event.notification.close();

  // Exemplo: abre a página principal do site
  event.waitUntil(
    clients.openWindow('https://prontiapp.com.br/')
  );
});
