// ======================================================
// CACHE OFFLINE - PRONTI APP
// ======================================================

const CACHE_NAME = "pronti-painel-v3"; // Atualizado para v3 para forçar a limpeza do cache antigo

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

// -------------------------------
// INSTALL
// -------------------------------
self.addEventListener("install", event => {
  console.log("[ServiceWorker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  // ativa imediatamente
  self.skipWaiting();
});

// -------------------------------
// FETCH (Estratégia Network-First para evitar repetição de notificações)
// -------------------------------
self.addEventListener("fetch", event => {
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
    // Tenta buscar na rede primeiro
    fetch(event.request)
      .then(fetchResponse => {
        // Se a rede responder e for um GET válido, atualiza o cache
        if (
          event.request.method === "GET" &&
          fetchResponse &&
          fetchResponse.ok &&
          fetchResponse.type === "basic"
        ) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      })
      .catch(() => {
        // Se falhar a rede (offline), busca no cache
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          // Fallback se estiver offline e não houver cache
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// -------------------------------
// ACTIVATE
// -------------------------------
self.addEventListener("activate", event => {
  console.log("[ServiceWorker] Activate");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // assume controle imediatamente
  self.clients.claim();
});
