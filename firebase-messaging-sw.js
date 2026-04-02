// =====================================================================
// firebase-messaging-sw.js  (Firebase v10.x)
// PRONTI APP - Push Notifications + Cache Offline (PWA)
// ✅ UNIFICADO: Junta o antigo service-worker.js (cache) com o firebase-messaging-sw.js (push)
//    Agora é UM ÚNICO service worker que faz tudo.
// ======================================================================

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
// MESSAGING (background push handler safe for any payload)
// --------------------------------------------------
const messaging = firebase.messaging();
const DEFAULT_VIEW_URL = "https://prontiapp.com.br/agendamentos";
const DEFAULT_FALLBACK_URL = "https://prontiapp.com.br/";

// Handler universal para TODAS as mensagens.
// Isso cobre: mensagens padrão do FCM, data-only, e mensagens de outros flows!
function getLinkFromPayload(payload) {
  // 1. Tenta nas raízes principais
  if (payload?.data) {
    if (payload.data.link) return payload.data.link;
    if (payload.data.url) return payload.data.url;
    // Se vier FCM_MSG aninhado (alguns navegadores antigos)
    if (payload.data.FCM_MSG) {
      try {
        const fcmMsg = typeof payload.data.FCM_MSG === "string"
          ? JSON.parse(payload.data.FCM_MSG)
          : payload.data.FCM_MSG;
        if (fcmMsg?.link) return fcmMsg.link;
        if (fcmMsg?.url) return fcmMsg.url;
        if (fcmMsg?.data?.link) return fcmMsg.data.link;
        if (fcmMsg?.data?.url) return fcmMsg.data.url;
      } catch (_) { /* ignore */ }
    }
  }
  // 2. WebPush/fcmOptions (caso Firebase Web mande nesse padrão)
  if (payload?.webpush?.fcmOptions?.link) return payload.webpush.fcmOptions.link;
  if (payload?.fcmOptions?.link) return payload.fcmOptions.link;
  // 3. Notification/click_action direto
  if (payload?.notification?.click_action) return payload.notification.click_action;
  // 4. Fallback
  return DEFAULT_FALLBACK_URL;
}

// ---------- Firebase Official handler ----------
messaging.onBackgroundMessage(function(payload) {
  try {
    // Sempre log para debug (remover em prod se incomodar)
    console.log("[Firebase SW] Push recebido:", payload);

    const data = payload?.data || {};
    const notif = payload?.notification || {};
    const title = notif.title || data.title || "Novo Agendamento";
    const body = notif.body || data.body || "Você tem um novo agendamento!";
    const icon = notif.icon || data.icon || "/icon.png";
    const image = notif.image || data.image;
    const badge = "/badge.png";

    const tag = `agendamento-${data.bilheteId || data.lembreteId || Date.now()}`;
    const link = getLinkFromPayload(payload);

    const options = {
      body,
      icon,
      image,
      badge,
      tag,
      requireInteraction: true,
      actions: [
        { action: "view", title: "Ver Agendamento" },
        { action: "dismiss", title: "Dispensar" },
      ],
      data: {
        ...data,
        link, // universal link: sempre na raiz do data
      }
    };

    self.registration.showNotification(title, options);

  } catch (err) {
    console.warn("[Firebase SW] Erro ao processar push em background:", err);
  }
});

// ------------- PLUS: Captura todo push não-firebase padrão -----------
self.addEventListener("push", function(event) {
  // Só cai aqui se a mensagem não foi interceptada pelo onBackgroundMessage (raro, mas cobre!)
  try {
    if (event.data) {
      const payload = event.data.json();
      const link = getLinkFromPayload(payload);
      const title = payload.notification?.title || payload.data?.title || "Pronti";
      const body = payload.notification?.body || payload.data?.body || "";
      self.registration.showNotification(title, {
        body,
        icon: payload.notification?.icon || payload.data?.icon || "/icon.png",
        badge: "/badge.png",
        data: { link }
      });
    }
  } catch (err) {
    console.warn("[Firebase SW] push fallback handler erro:", err);
  }
});

// --------------------------------------------------
// CLICK NA NOTIFICAÇÃO — universal para qualquer payload de link/url
// --------------------------------------------------
self.addEventListener("notificationclick", function(event) {
  try {
    event.notification.close();
    const data = event.notification?.data || {};
    // Universal: prioriza data.link mas garante em outros campos
    let link = data.link || data.url || DEFAULT_FALLBACK_URL;
    // Se FCM_MSG veio como string em data
    if ((!link || typeof link !== "string") && data.FCM_MSG) {
      try {
        const fcmMsg = typeof data.FCM_MSG === "string"
          ? JSON.parse(data.FCM_MSG)
          : data.FCM_MSG;
        link = fcmMsg?.link || fcmMsg?.url || fcmMsg?.data?.link || fcmMsg?.data?.url || DEFAULT_FALLBACK_URL;
      } catch (_) {}
    }
    if (event.action === "dismiss") return;
    if (!link || typeof link !== "string") link = DEFAULT_FALLBACK_URL;
    event.waitUntil(clients.openWindow(link));
  } catch (err) {
    console.warn("[Firebase SW] Erro no notificationclick:", err);
    event.waitUntil(clients.openWindow(DEFAULT_FALLBACK_URL));
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

// --------------------------------------------------
// INSTALL
// --------------------------------------------------
self.addEventListener("install", function(event) {
  console.log("[ServiceWorker] Install (unificado: push + cache)");
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// --------------------------------------------------
// FETCH (cache offline)
// --------------------------------------------------
self.addEventListener("fetch", function(event) {
  const url = event.request.url;
  // NÃO interferir com Firebase / APIs externas
  if (
    url.includes("firebase") ||
    url.includes("googleapis") ||
    url.includes("firestore") ||
    url.includes("gstatic")
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) {
        return response;
      }
      return fetch(event.request).then(function(fetchResponse) {
        // cacheia apenas GET do mesmo domínio
        if (
          event.request.method === "GET" &&
          fetchResponse &&
          fetchResponse.type === "basic"
        ) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    }).catch(function() {
      // fallback se estiver offline
      if (event.request.destination === "document") {
        return caches.match("/index.html");
      }
    })
  );
});

// --------------------------------------------------
// ACTIVATE
// --------------------------------------------------
self.addEventListener("activate", function(event) {
  console.log("[ServiceWorker] Activate (unificado: push + cache)");
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});
