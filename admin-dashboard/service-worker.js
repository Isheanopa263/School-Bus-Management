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
  console.log("[SW] Admin background message:", payload);
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "BusTrack Admin", {
    body: body || "You have a new notification",
    icon: "/admin-dashboard/assets/icons/icon-192.png",
    tag: payload.data?.type || "bustrack-admin",
    data: payload.data || {},
    vibrate: [200, 100, 200],
  });
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  let targetPage = "/admin-dashboard/dashboard.html";

  if (
    data.type === "sos" ||
    data.type === "breakdown" ||
    data.type === "new_complaint"
  ) {
    targetPage = "/admin-dashboard/complaints.html";
  } else if (data.type === "new_request") {
    targetPage = "/admin-dashboard/student-requests.html";
  }

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("admin-dashboard") && "focus" in client) {
            client.navigate(targetPage);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetPage);
      }),
  );
});
