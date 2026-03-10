// ======================================================================
// firebase-messaging-sw.js  (Firebase v10.x)
// PRONTI APP - Push Notifications
// ======================================================================
//
// Melhorias aplicadas SEM quebrar o que já funciona:
// - Mantém exibição de push em background via onBackgroundMessage()
// - Mantém actions ("Ver Agendamento" / "Dispensar")
// - ✅ Passa a abrir o link vindo no payload (data.link) quando existir
//   (fallback para as URLs antigas, então não afeta o que já funciona hoje)
// - ✅ Tag mais estável: usa bilheteId OU lembreteId (fallback Date.now())
// - ✅ Pequenas proteções (try/catch e defaults) para evitar falhas silenciosas
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

// URLs padrão (fallback) — mantém comportamento antigo
const DEFAULT_VIEW_URL = "https://prontiapp.com.br/agendamentos";
const DEFAULT_FALLBACK_URL = "https://prontiapp.com.br/";

// --------------------------------------------------
// RECEBE PUSH COM APP FECHADO
// --------------------------------------------------
messaging.onBackgroundMessage(function (payload) {
  try {
    console.log("[Firebase SW] Push recebido:", payload);

    const data = payload?.data || {};
    const notification = payload?.notification || {};

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

      // ✅ Tag mais estável: bilheteId OU lembreteId
      tag: `agendamento-${data.bilheteId || data.lembreteId || Date.now()}`,

      requireInteraction: true,

      actions: [
        { action: "view", title: "Ver Agendamento" },
        { action: "dismiss", title: "Dispensar" }
      ],

      // ✅ Mantém data inteira para o click (e permite data.link)
      data: {
        ...data,
        // ✅ se backend mandar data.link, será usado no click; se não, mantém fallback
        link: data.link || data.url || ""
      }
    };

    self.registration.showNotification(title, options);
  } catch (err) {
    // Evita quebrar o SW por payload inesperado
    console.warn("[Firebase SW] Erro ao processar push em background:", err);
  }
});

// --------------------------------------------------
// CLICK NA NOTIFICAÇÃO
// --------------------------------------------------
self.addEventListener("notificationclick", function (event) {
  try {
    console.log("[Firebase SW] Clique na notificação:", event.action);

    const data = event.notification?.data || {};
    const linkFromPayload = (data && (data.link || data.url)) ? String(data.link || data.url) : "";

    event.notification.close();

    if (event.action === "dismiss") return;

    // ✅ Mantém comportamento antigo:
    // - action "view" -> agendamentos
    // - clique normal -> home
    // ✅ Mas se vier data.link, usa ele (melhoria sem quebrar)
    let targetUrl = DEFAULT_FALLBACK_URL;

    if (event.action === "view") {
      targetUrl = DEFAULT_VIEW_URL;
    }

    if (linkFromPayload) {
      targetUrl = linkFromPayload;
    }

    event.waitUntil(clients.openWindow(targetUrl));
  } catch (err) {
    console.warn("[Firebase SW] Erro no notificationclick:", err);
    // fallback para não perder o clique
    event.waitUntil(clients.openWindow(DEFAULT_FALLBACK_URL));
  }
});

// --------------------------------------------------
// INSTALL
// --------------------------------------------------
self.addEventListener("install", function () {
  console.log("[Firebase SW] instalado");
  self.skipWaiting();
});

// --------------------------------------------------
// ACTIVATE
// --------------------------------------------------
self.addEventListener("activate", function (event) {
  console.log("[Firebase SW] ativado");
  event.waitUntil(self.clients.claim());
});
