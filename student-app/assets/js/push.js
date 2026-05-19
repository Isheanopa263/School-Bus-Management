/**
 * Push Notification Controller
 * Registers for Firebase Web Push and saves token to backend
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

  // ── Initialize ─────────────────────────────────────────────────────────
  async function init() {
    // Check browser support
    if (!("Notification" in window)) {
      console.warn("[PUSH] Notifications not supported");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("[PUSH] Service Worker not supported");
      return;
    }

    try {
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      messaging = firebase.messaging();

      // Request permission + get token
      await requestPermission();

      // Handle foreground messages
      messaging.onMessage((payload) => {
        console.log("[PUSH] Foreground message:", payload);
        showForegroundNotification(payload);
        // Also reload notifications tab if open
        if (typeof Notifications !== "undefined") {
          Notifications.load();
        }
      });
    } catch (err) {
      console.warn("[PUSH] Init failed:", err.message);
    }
  }

  // ── Request Permission ─────────────────────────────────────────────────
  async function requestPermission() {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      console.log("[PUSH] Permission granted");
      await getAndSaveToken();
    } else {
      console.warn("[PUSH] Permission denied");
    }
  }

  // ── Get Token ──────────────────────────────────────────────────────────
  async function getAndSaveToken() {
    try {
      console.log("[PUSH] Waiting for service worker...");
      const registration = await navigator.serviceWorker.ready;
      console.log("[PUSH] Service worker ready:", registration.scope);

      console.log("[PUSH] Requesting FCM token...");
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log(
          "[PUSH] FCM Token obtained:",
          token.substring(0, 20) + "...",
        );
        await saveTokenToBackend(token);
      } else {
        console.warn(
          "[PUSH] No token obtained - check VAPID key and Firebase config",
        );
      }
    } catch (err) {
      console.error("[PUSH] Get token failed:", err.code, err.message);
    }
  }

  // ── Save Token To Backend ──────────────────────────────────────────────
  async function saveTokenToBackend(token) {
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

  // ── Foreground Notification ────────────────────────────────────────────
  // Show notification when app is open (FCM doesn't show these automatically)
  function showForegroundNotification(payload) {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    // Show browser notification
    if (Notification.permission === "granted") {
      new Notification(title || "BusTrack", {
        body: body || "",
        icon: "/student-app/assets/icons/icon-192.png",
        tag: data.type || "bustrack",
        data: data,
      });
    }

    // Also show in-app toast
    showToast(title, body, data.type);
  }

  // ── In-App Toast ───────────────────────────────────────────────────────
  function showToast(title, message, type) {
    // Remove existing toast
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
    toast.style.cssText = `
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a2d40;
      border: 1px solid #10b981;
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 9999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      max-width: 380px;
      width: 90%;
      animation: slideDown 0.3s ease;
      cursor: pointer;
    `;

    toast.innerHTML = `
      <div style="font-size:24px">${iconMap[type] || "🔔"}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:#f1f5f9">${title || "Notification"}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:2px">${message || ""}</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
    `;

    // Add animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // Click to open notifications tab
    toast.addEventListener("click", () => {
      App.switchTab("notifications");
      toast.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 5000);
  }

  return { init, requestPermission };
})();
