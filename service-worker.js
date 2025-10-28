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

self.addEventListener("install", event => {
  console.log("[ServiceWorker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Evita interferir nas chamadas do Firebase, Google APIs ou Firestore
  if (url.includes("firebase") || url.includes("googleapis") || url.includes("firestore")) {
    return;
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

self.addEventListener("activate", event => {
  console.log("[ServiceWorker] Activate");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});
