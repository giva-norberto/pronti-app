// =====================================================================
// firebase-messaging-sw.js  (Firebase v10.x)
// PRONTI APP - Push Notifications + Cache Offline (PWA)
// ✅ UNIFICADO: Push + Cache Offline
// ======================================================================

// Firebase compat para Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// --------------------------------------------------
// CONFIG FIREBASE
// --------------------------------------------------
firebase.initializeApp({
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

const messaging = firebase.messaging();

// URLs padrão (fallback)
const DEFAULT_VIEW_URL = "https://prontiapp.com.br/agendamentos";
const DEFAULT_FALLBACK_URL = "https://prontiapp.com.br/";

// --------------------------------------------------
// RECEBE PUSH COM APP FECHADO
// --------------------------------------------------
messaging.onBackgroundMessage(function (payload) {
  console.log("[Firebase SW] Push recebido:", payload);

  const data = payload?.data || {};
  const notification = payload?.notification || {};

  // Prioriza o link vindo da Cloud Function (fcmOptions ou data.link)
  const clickUrl = data.link || (payload.fcmOptions && payload.fcmOptions.link) || data.url || "";

  const title = notification.title || data.title || "Pronti";
  const options = {
    body: notification.body || data.body || "Você tem uma nova atualização!",
    icon: notification.icon || data.icon || "/icon.png",
    image: notification.image || data.image,
    badge: "/badge.png",
    // Usa a tag enviada para evitar duplicidade e spam
    tag: data.tag || `pronti-aviso-${Date.now()}`,
    requireInteraction: true,
    data: {
      ...data,
      link: clickUrl
    }
  };

  // O 'return' é obrigatório para o Chrome não mostrar "site atualizado em segundo plano"
  return self.registration.showNotification(title, options);
});

// --------------------------------------------------
// CLICK NA NOTIFICAÇÃO
// --------------------------------------------------
self.addEventListener("notificationclick", function (event) {
  try {
    event.notification.close();
    
    const data = event.notification?.data || {};
    // Pega o link que injetamos na Cloud Function
    const linkFromPayload = data.link || "";

    let targetUrl = DEFAULT_FALLBACK_URL;

    if (linkFromPayload) {
      targetUrl = linkFromPayload;
    } else if (event.action === "view") {
      targetUrl = DEFAULT_VIEW_URL;
    }

    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
        // Se já houver uma aba aberta no site, foca nela
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i];
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Se não, abre uma nova janela
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  } catch (err) {
    console.warn("[Firebase SW] Erro no notificationclick:", err);
  }
});

// ======================================================
// CACHE OFFLINE - PRONTI APP
// ======================================================
const CACHE_NAME = "pronti-painel-v2";
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/menu-principal.css",
  "/menu-lateral.html",
  "/menu-lateral.js",
  "/dashboard.html",
  "/perfil.html"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
  const url = event.request.url;
  if (url.includes("firebase") || url.includes("googleapis") || url.includes("firestore") || url.includes("gstatic")) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (response) {
      if (response) return response;
      return fetch(event.request).then(function (fetchResponse) {
        if (event.request.method === "GET" && fetchResponse && fetchResponse.type === "basic") {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    }).catch(function () {
      if (event.request.destination === "document") {
        return caches.match("/index.html");
      }
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});
