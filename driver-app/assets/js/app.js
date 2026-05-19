// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/driver-app/service-worker.js")
    .then((reg) => console.log("[SW] Registered:", reg.scope))
    .catch((err) => console.error("[SW] Failed:", err.message));
}

/**
 * App Core
 * - Checks auth state on load
 * - Manages screen transitions
 * - Handles logout
 */
const App = (() => {
  function init() {
    const nav = performance.getEntriesByType("navigation");
    const isReload = nav.length ? nav[0].type === "reload" : false;

    if (isReload) {
      sessionStorage.removeItem("driver_token");
      sessionStorage.removeItem("driver_info");
      sessionStorage.removeItem("active_trip");
    }

    const token = sessionStorage.getItem("driver_token");

    if (token && !isTokenExpired(token)) {
      showScreen("route");
    } else {
      sessionStorage.removeItem("driver_token");
      sessionStorage.removeItem("driver_info");
      sessionStorage.removeItem("active_trip");
      showScreen("login");
    }
  }

  function showScreen(name) {
    const app = document.getElementById("app");

    // Get template
    const templateId = `tpl-${name}`;
    const template = document.getElementById(templateId);
    if (!template) {
      console.error(`Template not found: ${templateId}`);
      return;
    }

    // Render screen
    app.innerHTML = "";
    app.appendChild(template.content.cloneNode(true));

    // Initialize screen controller
    if (name === "login") LoginScreen.init();
    if (name === "route") {
      RouteView.init();
      DriverPush.init();
    }
  }

  function logout() {
    sessionStorage.removeItem("driver_token");
    sessionStorage.removeItem("driver_info");
    sessionStorage.removeItem("active_trip");
    showScreen("login");
  }

  function isTokenExpired(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now();
    } catch (err) {
      console.warn("Token check error:", err.message);
      return false;
    }
  }
  return { init, showScreen, logout };
})();

// Boot app
document.addEventListener("DOMContentLoaded", () => App.init());
