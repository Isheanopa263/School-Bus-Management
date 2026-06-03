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

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "BusTrack Student", {
    body: body || "You have a new notification",
    tag: payload.data?.type || "bustrack-student",
    data: payload.data || {},
    vibrate: [200, 100, 200],
  });
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if (c.url.includes("student-app") && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("index.html");
    }),
  );
});
