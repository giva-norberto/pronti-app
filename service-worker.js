// ======================================================================
// service-worker.js (ARQUIVO ÚNICO FUNDIDO)
// Contém a lógica do PWA (Cache) e do Firebase (Push).
// ======================================================================

// === PARTE 1: LÓGICA DO FIREBASE PUSH ===
// (Copiado do seu 'firebase-messaging-sw.js')

// Importa a versão compatível para Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js' );
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js' );

// === Configuração do Firebase ===
firebase.initializeApp({
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",  
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

// === Inicializa o Messaging ===
const messaging = firebase.messaging();

// === Recebe mensagens em segundo plano ===
messaging.onBackgroundMessage(function (payload) {
  console.log('[service-worker.js] Mensagem em segundo plano recebida:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Novo Agendamento';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Você tem um novo agendamento!',
    icon: payload.notification?.icon || payload.data?.icon || '/icon.png',
    image: payload.notification?.image || payload.data?.image,
    badge: '/badge.png',
    tag: `agendamento-${payload.data?.bilheteId || Date.now()}`, 
    requireInteraction: true, 
    actions: [
      { action: 'view', title: 'Ver Agendamento' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
    data: payload.data 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// === Clique na notificação ===
self.addEventListener('notificationclick', function (event) {
  console.log('[service-worker.js] Notificação clicada. Ação:', event.action);

  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('https://prontiapp.com.br/agendamentos' )
    );
  } else if (event.action === 'dismiss') {
    return;
  } else {
    event.waitUntil(
      clients.openWindow('https://prontiapp.com.br/' )
    );
  }
});


// === PARTE 2: LÓGICA DO PWA CACHE ===
// (Copiado do seu 'service-worker.js' de cache)

const CACHE_NAME = "pronti-painel-v1";
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

// === Evento de Instalação (Fundido) ===
// (Usa a sua lógica de cache, que já inclui o self.skipWaiting())
self.addEventListener("install", event => {
  console.log("[service-worker.js] Install (Cache + Push)");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[service-worker.js] Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting(); // (Do seu código de cache)
});

// === Evento Fetch (Cache) ===
// (Do seu código de cache - 100% intacto)
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Evita interferir nas chamadas do Firebase, Google APIs ou Firestore
  if (url.includes("firebase") || url.includes("googleapis") || url.includes("firestore")) {
    return; // Não faz cache de requisições do Firebase
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request)
        .then(fetchResponse => {
          // Só cacheia GETs do mesmo domínio
          if (event.request.method === "GET" && fetchResponse.type === "basic") {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return fetchResponse;
        });
    }).catch(() => {
      // fallback opcional, ex: retornar página offline
      if (event.request.destination === "document") {
        return caches.match("/index.html");
      }
    })
  );
});

// === Evento de Ativação (Fundido) ===
// (Usa a sua lógica de cache, que já inclui o self.clients.claim())
self.addEventListener("activate", event => {
  console.log("[service-worker.js] Activate (Cache + Push)");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim(); // (Do seu código de cache)
});
