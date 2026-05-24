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

    // Sidebar toggle - mobile
    document.getElementById("menu-toggle")?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
      document.getElementById("sidebar-overlay").classList.toggle("active");
    });

    // Sidebar collapse - desktop
    document
      .getElementById("sidebar-collapse")
      ?.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("collapsed");
      });

    // Sidebar overlay close
    document
      .getElementById("sidebar-overlay")
      ?.addEventListener("click", () => {
        document.getElementById("sidebar").classList.remove("open");
        document.getElementById("sidebar-overlay").classList.remove("active");
      });

    // Sidebar nav switching
    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.addEventListener("click", () => {
        switchTab(link.dataset.tab);
        // Close mobile sidebar on nav click
        document.getElementById("sidebar").classList.remove("open");
        document.getElementById("sidebar-overlay").classList.remove("active");
      });
    });

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document
      .getElementById("profileLogoutBtn")
      ?.addEventListener("click", logout);

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
    const avatar = document.getElementById("sidebar-avatar");
    const name = document.getElementById("sidebar-student-name");
    const busNum = document.getElementById("sidebar-bus-number");
    const topName = document.getElementById("top-student-name");
    const greetingName = document.getElementById("greetingName");

    if (avatar && profile?.full_name) {
      avatar.textContent = profile.full_name.charAt(0).toUpperCase();
    }
    if (name && profile?.full_name) {
      name.textContent = profile.full_name;
    }
    if (busNum && profile?.bus_number) {
      busNum.textContent = `Bus ${profile.bus_number}`;
    }
    if (topName && profile?.full_name) {
      topName.textContent = profile.full_name.split(" ")[0];
    }
    if (greetingName && profile?.full_name) {
      greetingName.textContent = `Hello, ${profile.full_name.split(" ")[0]} 👋`;
    }
  }

  function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    document.querySelectorAll(".tab-content").forEach((section) => {
      section.classList.toggle("active", section.id === `tab-${tab}`);
    });

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
