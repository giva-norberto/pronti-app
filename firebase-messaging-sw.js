// ======================================================================
// firebase-messaging-sw.js  (Firebase v10.x)
// PRONTI APP - Push Notifications
// ======================================================================

// Firebase compat para Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// --------------------------------------------------
// CONFIG FIREBASE (mesma do firebase-config.js)
// --------------------------------------------------
firebase.initializeApp({
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

// --------------------------------------------------
// MESSAGING
// --------------------------------------------------
const messaging = firebase.messaging();

// --------------------------------------------------
// RECEBE PUSH COM APP FECHADO
// --------------------------------------------------
messaging.onBackgroundMessage(function(payload) {

  console.log("[Firebase SW] Push recebido:", payload);

  const data = payload.data || {};
  const notification = payload.notification || {};

  const title =
    notification.title ||
    data.title ||
    "Novo Agendamento";

  const options = {
    body:
      notification.body ||
      data.body ||
      "Você tem um novo agendamento!",

    icon: notification.icon || data.icon || "/icon.png",

    image: notification.image || data.image,

    badge: "/badge.png",

    tag: `agendamento-${data.bilheteId || Date.now()}`,

    requireInteraction: true,

    actions: [
      {
        action: "view",
        title: "Ver Agendamento"
      },
      {
        action: "dismiss",
        title: "Dispensar"
      }
    ],

    data: data
  };

  self.registration.showNotification(title, options);

});

// --------------------------------------------------
// CLICK NA NOTIFICAÇÃO
// --------------------------------------------------
self.addEventListener("notificationclick", function(event) {

  console.log("[Firebase SW] Clique na notificação:", event.action);

  event.notification.close();

  if (event.action === "view") {

    event.waitUntil(
      clients.openWindow("https://prontiapp.com.br/agendamentos")
    );

    return;
  }

  if (event.action === "dismiss") {
    return;
  }

  event.waitUntil(
    clients.openWindow("https://prontiapp.com.br/")
  );

});

// --------------------------------------------------
// INSTALL
// --------------------------------------------------
self.addEventListener("install", function(event) {

  console.log("[Firebase SW] instalado");

  self.skipWaiting();

});

// --------------------------------------------------
// ACTIVATE
// --------------------------------------------------
self.addEventListener("activate", function(event) {

  console.log("[Firebase SW] ativado");

  event.waitUntil(self.clients.claim());

});
