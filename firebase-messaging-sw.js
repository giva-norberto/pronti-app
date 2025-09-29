// ======================================================================
// firebase-messaging-sw.js  (para Firebase v10.x)
// REVISADO: storageBucket corrigido para corresponder ao firebase-config.js
// ======================================================================

// Importa a versão compatível para Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js' );
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js' );

// === Configuração do Firebase (AGORA IDÊNTICA ao firebase-config.js) ===
firebase.initializeApp({
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  // ✅ CORRIGIDO: Usando .firebasestorage.app para consistência
  storageBucket: "pronti-app-37c6e.firebasestorage.app", 
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

// === Inicializa o Messaging ===
const messaging = firebase.messaging();

// === Recebe mensagens em segundo plano ===
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Mensagem em segundo plano recebida:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Novo Agendamento';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Você tem um novo agendamento!',
    icon: payload.notification?.icon || payload.data?.icon || '/icon.png',
    image: payload.notification?.image || payload.data?.image,
    badge: '/badge.png',
    tag: 'agendamento', // Permite agrupar notificações
    requireInteraction: true, // Mantém a notificação visível até o usuário interagir
    actions: [
      {
        action: 'view',
        title: 'Ver Agendamento'
      },
      {
        action: 'dismiss',
        title: 'Dispensar'
      }
    ]
  };

  // Exibe a notificação usando a API de Service Worker
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// === Clique na notificação ===
self.addEventListener('notificationclick', function (event) {
  console.log('[firebase-messaging-sw.js] Notificação clicada. Ação:', event.action);

  // Fecha a notificação após o clique
  event.notification.close();

  // Lógica para diferentes ações de clique
  if (event.action === 'view') {
    // Abre a página de agendamentos em uma nova aba/janela
    event.waitUntil(
      clients.openWindow('https://prontiapp.com.br/agendamentos' )
    );
  } else if (event.action === 'dismiss') {
    // Nenhuma ação adicional, a notificação já foi fechada
    console.log('[firebase-messaging-sw.js] Notificação dispensada.');
    return;
  } else {
    // Comportamento padrão: abre a página inicial do aplicativo
    event.waitUntil(
      clients.openWindow('https://prontiapp.com.br/' )
    );
  }
});

// === Instalação do Service Worker ===
self.addEventListener('install', function(event) {
  console.log('[firebase-messaging-sw.js] Service Worker instalado.');
  // Força a ativação do novo Service Worker imediatamente, sem esperar o fechamento de abas antigas.
  self.skipWaiting();
});

// === Ativação do Service Worker ===
self.addEventListener('activate', function(event) {
  console.log('[firebase-messaging-sw.js] Service Worker ativado.');
  // Assume o controle de todas as abas abertas que estão no escopo do Service Worker.
  event.waitUntil(self.clients.claim());
});
