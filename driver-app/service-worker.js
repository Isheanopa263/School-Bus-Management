importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyBBZn4WXourIrUdjCCm8HyBfEVNlCjic0o",
  authDomain: "bus-system-62850.firebaseapp.com",
  projectId: "bus-system-62850",
  storageBucket: "bus-system-62850.firebasestorage.app",
  messagingSenderId: "92951661699",
  appId: "1:92951661699:web:443defdba4c9aa8a995fb6",
});

const messaging = firebase.messaging();

const CACHE_NAME = "driver-app-v2";
const STATIC_ASSETS = [
  "/driver-app/index.html",
  "/driver-app/assets/css/app.css",
  "/driver-app/assets/js/app.js",
  "/driver-app/assets/js/api.js",
  "/driver-app/assets/js/login.js",
  "/driver-app/assets/js/gps.js",
  "/driver-app/assets/js/navigation.js",
  "/driver-app/assets/js/route-view.js",
  "/driver-app/assets/js/push.js",
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

  // Only handle GET requests for caching
  if (e.request.method !== "GET") return;

  // Never cache API calls
  if (url.hostname === "localhost" || url.pathname.startsWith("/api/")) return;

  // Only cache same-origin static files
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(e.request, clone));
          }
          return response;
        }),
    ),
  );
});

// Background push
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Driver background message:", payload);
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "BusTrack Driver", {
    body: body || "You have a new notification",
    icon: "/driver-app/assets/icons/icon-192.png",
    tag: payload.data?.type || "bustrack-driver",
    data: payload.data || {},
    vibrate: [200, 100, 200],
  });
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("driver-app") && "focus" in client)
            return client.focus();
        }
        if (clients.openWindow)
          return clients.openWindow("/driver-app/index.html");
      }),
  );
});
