/**
 * Admin Dashboard Push Notification Controller
 */
const AdminPush = (() => {
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

    const isLoginPage =
      window.location.pathname.endsWith("index.html") ||
      window.location.pathname.endsWith("/admin-dashboard/");
    if (isLoginPage) return;

    try {
      // Register service worker with relative path
      const swReg = await navigator.serviceWorker.register("service-worker.js");
      console.log("[PUSH] Service worker registered:", swReg.scope);

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      messaging = firebase.messaging();

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[PUSH] Permission denied");
        return;
      }

      console.log("[PUSH] Admin permission granted");

      await navigator.serviceWorker.ready;
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        console.log("[PUSH] Admin token obtained");
        await saveToken(token);
      } else {
        console.warn("[PUSH] No token obtained");
      }

      messaging.onMessage((payload) => {
        console.log("[PUSH] Admin foreground message:", payload);
        showAdminToast(payload);
      });
    } catch (err) {
      console.warn("[PUSH] Admin init failed:", err.message);
    }
  }

  async function saveToken(token) {
    try {
      const adminToken = sessionStorage.getItem("admin_token");
      if (!adminToken) return;

      await fetch(
        document.querySelector('script[src*="api.js"]')
          ? `${API_BASE.replace("/api", "")}/api/notifications/token`
          : "https://school-bus-management-production.up.railway.app/api/notifications/token",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ fcm_token: token }),
        },
      );
      console.log("[PUSH] Admin token saved");
    } catch (err) {
      console.warn("[PUSH] Admin token save failed:", err.message);
    }
  }

  function showAdminToast(payload) {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    if (Notification.permission === "granted") {
      new Notification(title || "BusTrack Admin", { body: body || "" });
    }

    const existing = document.getElementById("adminPushToast");
    if (existing) existing.remove();

    const iconMap = {
      sos: "🚨",
      breakdown: "🔧",
      new_request: "📋",
      new_complaint: "⚠️",
    };
    const colorMap = {
      sos: "#ef4444",
      breakdown: "#f59e0b",
      new_request: "#6366f1",
      new_complaint: "#f59e0b",
    };
    const borderColor = colorMap[data.type] || "#6366f1";

    const toast = document.createElement("div");
    toast.id = "adminPushToast";
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:#1e293b;border:1px solid ${borderColor};border-left:4px solid ${borderColor};border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:12px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:400px;cursor:pointer;`;
    toast.innerHTML = `
      <div style="font-size:24px">${iconMap[data.type] || "🔔"}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:#f1f5f9">${title || "Notification"}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:2px">${body || ""}</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer">✕</button>`;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 8000);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => AdminPush.init());
