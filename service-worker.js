// ======================================================================
// service-worker.js (HOTFIX v2)
// CORRIGIDO: A lógica de 'fetch' (cache) foi simplificada 
// para NÃO interferir com as chamadas de API (Firestore/Agenda).
// ======================================================================

// === PARTE 1: LÓGICA DO FIREBASE PUSH ===
// (Esta parte está 100% intacta)

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js' );
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js' );

firebase.initializeApp({
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",  
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log('[service-worker.js] Mensagem em segundo plano recebida:', payload);
  // (Lógica de 'onBackgroundMessage' intacta)
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

self.addEventListener('notificationclick', function (event) {
  console.log('[service-worker.js] Notificação clicada. Ação:', event.action);
  // (Lógica de 'notificationclick' intacta)
  event.notification.close();
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow('https://prontiapp.com.br/agendamentos'));
  } else if (event.action === 'dismiss') {
    return;
  } else {
    event.waitUntil(clients.openWindow('https://prontiapp.com.br/'));
  }
});


// === PARTE 2: LÓGICA DO PWA CACHE ===
// (Esta parte foi CORRIGIDA para ser mais segura)

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

// === Evento de Instalação (Intacto) ===
self.addEventListener("install", event => {
  console.log("[service-worker.js] Install (Cache + Push)");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[service-worker.js] Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ==================================================================
//  ✅ HOTFIX: Lógica de 'fetch' corrigida
// ==================================================================
self.addEventListener("fetch", event => {
  // Ignora requisições que não são GET (como POST, PUT, etc)
  if (event.request.method !== 'GET') {
    return; // Deixa o navegador lidar
  }

  const requestUrl = new URL(event.request.url);

  // Verifica se a requisição é para um dos arquivos da "casca" (app shell)
  // Usamos requestUrl.pathname para ignorar ?query=params
  const isAppShellFile = FILES_TO_CACHE.some(file => requestUrl.pathname.endsWith(file));

  if (isAppShellFile) {
    // Se for um arquivo da "casca", usa a estratégia Cache First.
    console.log(`[SW Cache] Servindo do cache: ${requestUrl.pathname}`);
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request); // Se falhar, busca na rede
      })
    );
  } else {
    // Para TODAS as outras requisições (APIs, Firestore, imagens, etc.),
    // o service worker NÃO INTERFERE. Deixa ir para a rede.
    // (Fazemos isso simplesmente não chamando event.respondWith())
    return;
  }
});

// === Evento de Ativação (Intacto) ===
self.addEventListener("activate", event => {
  console.log("[service-worker.js] Activate (Cache + Push)");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});
