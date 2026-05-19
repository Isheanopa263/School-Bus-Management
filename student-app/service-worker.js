// ── Firebase SDK for Service Worker ───────────────────────────────────────
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js",
);

// ── Firebase Config ────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyBBZn4WXourIrUdjCCm8HyBfEVNlCjic0o",
  authDomain: "bus-system-62850.firebaseapp.com",
  projectId: "bus-system-62850",
  storageBucket: "bus-system-62850.firebasestorage.app",
  messagingSenderId: "92951661699",
  appId: "1:92951661699:web:443defdba4c9aa8a995fb6",
});

const messaging = firebase.messaging();

// ── Cache Config ───────────────────────────────────────────────────────────
const CACHE_NAME = "student-app-v2";

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
  "/student-app/assets/js/profile.js",
  "/student-app/assets/js/push.js",
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────
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

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Only cache GET requests
  if (e.request.method !== "GET") return;

  // Never cache API or external calls
  if (url.hostname === "localhost" || url.pathname.startsWith("/api/")) return;

  // Only cache same-origin files
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
// ── Background Push Notifications ─────────────────────────────────────────
// Handles notifications when app is in background or closed
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  const notificationTitle = title || "BusTrack";
  const notificationOptions = {
    body: body || "You have a new notification",
    icon: "/student-app/assets/icons/icon-192.png",
    badge: "/student-app/assets/icons/icon-192.png",
    tag: data.type || "bustrack",
    data: data,
    vibrate: [200, 100, 200],
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Notification Click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  if (e.action === "dismiss") return;

  const appUrl = "/student-app/index.html";

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app already open, focus it
        for (const client of clientList) {
          if (client.url.includes("student-app") && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(appUrl);
        }
      }),
  );
});
