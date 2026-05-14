const CACHE_NAME = "student-app-v1";

const STATIC_ASSETS = [
  "/student-app/index.html",
  "/student-app/assets/css/app.css",
  "/student-app/assets/js/api.js",
  "/student-app/assets/js/app.js",
  "/student-app/assets/js/auth.js",
  "/student-app/assets/js/home.js",
  "/student-app/assets/js/bus.js",
  "/student-app/assets/js/tracking.js",
  "/student-app/assets/js/notifications.js",
  "/student-app/assets/js/complaint.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        }),
    ),
  );
});
