const CACHE_NAME = "driver-app-v1";

const STATIC_ASSETS = [
  "/driver-app/index.html",
  "/driver-app/assets/css/app.css",
  "/driver-app/assets/js/app.js",
  "/driver-app/assets/js/api.js",
  "/driver-app/assets/js/login.js",
  "/driver-app/assets/js/route-view.js",
  "/driver-app/assets/js/gps.js",
  "/driver-app/assets/js/navigation.js",
];

// Install - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch - cache first for static, network first for API
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls - network first, no caching
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return response;
        })
      );
    }),
  );
});
