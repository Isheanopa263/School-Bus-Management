// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/student-app/service-worker.js")
    .then((reg) => {
      console.log("[SW] Registered:", reg.scope);
    })
    .catch((err) => {
      console.error("[SW] Registration failed:", err.message);
    });
}
/**
 * App Core - Top Nav Layout
 */
const App = (() => {
  let currentTab = "home";
  let studentProfile = null;

  function init() {
    const token = sessionStorage.getItem("student_token");

    if (token && !isTokenExpired(token)) {
      showScreen("main");
    } else {
      sessionStorage.removeItem("student_token");
      sessionStorage.removeItem("student_info");
      showScreen("welcome");
    }
  }

  function showScreen(name) {
    const app = document.getElementById("app");
    const template = document.getElementById(`tpl-${name}`);
    if (!template) return;

    sessionStorage.setItem("current_screen", name);
    app.innerHTML = "";
    app.appendChild(template.content.cloneNode(true));

    switch (name) {
      case "welcome":
        initWelcome();
        break;
      case "login":
        Auth.initLogin();
        break;
      case "register":
        Auth.initRegister();
        break;
      case "main":
        initMain();
        break;
    }
  }

  function initWelcome() {
    document
      .getElementById("goLoginBtn")
      .addEventListener("click", () => showScreen("login"));
    document
      .getElementById("goRegisterBtn")
      .addEventListener("click", () => showScreen("register"));
  }

  async function initMain() {
    // Date
    const dateEl = document.getElementById("greetingDate");
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }

    // Nav tab switching
    document.querySelectorAll(".nav-link[data-tab]").forEach((link) => {
      link.addEventListener("click", () => switchTab(link.dataset.tab));
    });

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", logout);

    // Load profile
    try {
      const data = await StudentAPI.getProfile();
      studentProfile = data.profile;
      setHeaderInfo(studentProfile);
      Home.render(studentProfile);
      Bus.render(studentProfile);
    } catch (err) {
      console.error("Profile load error:", err);
      const stored = JSON.parse(sessionStorage.getItem("student_info") || "{}");
      setHeaderInfo(stored);
    }
    // Initialize push notifications
    try {
      await Push.init();
    } catch (err) {
      console.warn("Push init failed:", err.message);
    }

    Tracking.init();
    Notifications.init();
    Complaint.init();
    Profile.render(studentProfile);
  }

  function setHeaderInfo(profile) {
    const avatar = document.getElementById("headerAvatar");
    const name = document.getElementById("greetingName");
    if (avatar && profile?.full_name) {
      avatar.textContent = profile.full_name.charAt(0).toUpperCase();
    }
    if (name && profile?.full_name) {
      name.textContent = `Hello, ${profile.full_name.split(" ")[0]} 👋`;
    }
  }

  function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll(".nav-link[data-tab]").forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    document.querySelectorAll(".tab-content").forEach((section) => {
      section.classList.toggle("active", section.id === `tab-${tab}`);
    });

    // Stop tracking refresh when leaving tracking tab
    if (tab !== "tracking" && typeof Tracking !== "undefined") {
      Tracking.stopRefresh && Tracking.stopRefresh();
    }

    switch (tab) {
      case "home":
        if (studentProfile) Home.render(studentProfile);
        break;
      case "bus":
        if (studentProfile) Bus.render(studentProfile);
        break;
      case "tracking":
        Tracking.load();
        break;
      case "notifications":
        Notifications.load();
        break;
      case "complaint":
        Complaint.render();
        break;
      case "profile":
        if (studentProfile) Profile.render(studentProfile);
        break;
    }
  }

  function logout() {
    sessionStorage.removeItem("student_token");
    sessionStorage.removeItem("student_info");
    showScreen("welcome");
  }

  function isTokenExpired(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false; // No expiry = never expires
      return payload.exp * 1000 < Date.now();
    } catch (err) {
      console.warn("Token check error:", err.message);
      return false; // Don't logout on parse error, let backend validate
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return { showScreen, switchTab, logout, getProfile: () => studentProfile };
})();
