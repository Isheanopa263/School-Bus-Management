/**
 * Driver App Push Notification Controller
 */
const DriverPush = (() => {
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
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log("[PUSH] Token obtained");
        await saveToken(token);
      } else {
        console.warn("[PUSH] No token obtained");
      }

      messaging.onMessage((payload) => {
        console.log("[PUSH] Foreground message:", payload);
        showToast(payload);
      });
    } catch (err) {
      console.warn("[PUSH] Init failed:", err.message);
    }
  }

  async function saveToken(token) {
    try {
      const driverToken = sessionStorage.getItem("driver_token");
      if (!driverToken) return;

      const baseUrl =
        typeof API_BASE !== "undefined"
          ? API_BASE.replace("/api", "")
          : "https://school-bus-management-production.up.railway.app";

      await fetch(`${baseUrl}/api/notifications/token`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ fcm_token: token }),
      });
      console.log("[PUSH] Token saved");
    } catch (err) {
      console.warn("[PUSH] Token save failed:", err.message);
    }
  }

  function showToast(payload) {
    const { title, body } = payload.notification || {};

    if (Notification.permission === "granted") {
      new Notification(title || "BusTrack Driver", { body: body || "" });
    }

    const existing = document.getElementById("driverPushToast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "driverPushToast";
    toast.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#1a2540;border:1px solid #0ea5e9;border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:12px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:380px;width:90%;cursor:pointer;`;
    toast.innerHTML = `
      <div style="font-size:24px">🔔</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:#f1f5f9">${title || "Notification"}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:2px">${body || ""}</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">✕</button>`;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 5000);
  }

  return { init };
})();
