// ======================================================================
// firebase-messaging-sw.js  (para Firebase v10.x)
// ======================================================================

// Importa a versão compatível para Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// === Configuração do Firebase (a mesma do firebase-config.js) ===
firebase.initializeApp({
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4", // CHAVE NOVA
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

// === Inicializa o Messaging ===
const messaging = firebase.messaging();

// === Recebe mensagens em segundo plano ===
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Mensagem em segundo plano:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Nova notificação';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || payload.data?.icon || '/icon.png',
    image: payload.notification?.image || payload.data?.image
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// === Clique na notificação ===
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://prontiapp.com.br/')
  );
});
