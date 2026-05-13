/**
 * App Core
 * - Checks auth state on load
 * - Manages screen transitions
 * - Handles logout
 */
const App = (() => {
  function init() {
    const token = localStorage.getItem("driver_token");
    if (token && !isTokenExpired(token)) {
      showScreen("route");
    } else {
      // Clear any stale data
      localStorage.removeItem("driver_token");
      localStorage.removeItem("driver_info");
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
    if (name === "route") RouteView.init();
  }

  function logout() {
    localStorage.removeItem("driver_token");
    localStorage.removeItem("driver_info");
    showScreen("login");
  }

  function isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  return { init, showScreen, logout };
})();

// Boot app
document.addEventListener("DOMContentLoaded", () => App.init());
