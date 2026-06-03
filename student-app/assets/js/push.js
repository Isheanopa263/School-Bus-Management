/**
 * Student App Push Notification Controller
 */
const Push = (() => {
  const VAPID_KEY =
    "BAVjoNfVELYUfMZ7ZT0sLJQk4oSFLYwTkGj0QhZa3RR4NIOlej9kYrZ6r7MKtkSsGsblvG--E0bHc1AwYMCSeMA";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBBZn4WXourIrUdjCCm8HyBfEVNlCjic0o",
    authDomain: "bus-system-62850.firebaseapp.com",
    projectId: "bus-system-62850",
    storageBucket: "bus-system-62850.firebasestorage.app",
    messagingSenderId: "92951661699",
    appId: "1:92951661699:web:443defdba4c9aa8a995fb6",
  };

  let messaging = null;

  async function init() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.warn("[PUSH] Not supported");
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      messaging = firebase.messaging();

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[PUSH] Permission denied");
        return;
      }

      console.log("[PUSH] Permission granted");

      const registration = await navigator.serviceWorker.ready;
      console.log("[PUSH] Service worker ready:", registration.scope);

      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log("[PUSH] FCM Token obtained");
        await saveToken(token);
      } else {
        console.warn("[PUSH] No token obtained");
      }

      messaging.onMessage((payload) => {
        console.log("[PUSH] Foreground message:", payload);
        showToast(payload);
        if (typeof Notifications !== "undefined") {
          Notifications.load();
        }
      });
    } catch (err) {
      console.warn("[PUSH] Init failed:", err.message);
    }
  }

  async function saveToken(token) {
    try {
      await apiFetch("/notifications/token", {
        method: "PUT",
        body: JSON.stringify({ fcm_token: token }),
      });
      console.log("[PUSH] Token saved to backend");
    } catch (err) {
      console.warn("[PUSH] Failed to save token:", err.message);
    }
  }

  function showToast(payload) {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    if (Notification.permission === "granted") {
      new Notification(title || "BusTrack", { body: body || "" });
    }

    const existing = document.getElementById("pushToast");
    if (existing) existing.remove();

    const iconMap = {
      bus_arriving: "🚌",
      bus_approved: "✅",
      bus_rejected: "❌",
      trip_started: "🚌",
    };

    const toast = document.createElement("div");
    toast.id = "pushToast";
    toast.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#1a2d40;border:1px solid #10b981;border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:12px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:380px;width:90%;cursor:pointer;`;
    toast.innerHTML = `
      <div style="font-size:24px">${iconMap[data.type] || "🔔"}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:#f1f5f9">${title || "Notification"}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:2px">${body || ""}</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">✕</button>`;

    toast.addEventListener("click", () => {
      App.switchTab("notifications");
      toast.remove();
    });

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 5000);
  }

  return { init };
})();
