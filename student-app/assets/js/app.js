// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then((reg) => console.log("[SW] Registered:", reg.scope))
    .catch((err) => console.error("[SW] Failed:", err.message));
}

/**
 * App Core - Sidebar Layout
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

    // Setup theme toggle after any screen
    setTimeout(() => {
      if (window.setupThemeToggle) setupThemeToggle();
    }, 100);
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

    // Sidebar collapse (desktop)
    const collapseBtn = document.getElementById("sidebarCollapse");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        const sidebar = document.getElementById("sidebar");
        sidebar.classList.toggle("collapsed");
        localStorage.setItem(
          "student_sidebar_collapsed",
          sidebar.classList.contains("collapsed"),
        );
      });

      // Restore collapsed state
      if (localStorage.getItem("student_sidebar_collapsed") === "true") {
        document.getElementById("sidebar").classList.add("collapsed");
      }
    }

    // Mobile menu toggle
    const menuToggle = document.getElementById("menuToggle");
    const overlay = document.getElementById("sidebarOverlay");

    if (menuToggle) {
      menuToggle.addEventListener("click", () => {
        document.getElementById("sidebar").classList.add("open");
        if (overlay) overlay.classList.add("show");
      });
    }

    if (overlay) {
      overlay.addEventListener("click", () => {
        document.getElementById("sidebar").classList.remove("open");
        overlay.classList.remove("show");
      });
    }

    // Sidebar nav links
    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.addEventListener("click", () => switchTab(link.dataset.tab));
    });

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    }

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

    // Initialize screens
    Tracking.init();
    Notifications.init();
    Complaint.init();

    // Push notifications
    try {
      await Push.init();
    } catch (err) {
      console.warn("Push init failed:", err.message);
    }

    // Setup theme toggle
    if (window.setupThemeToggle) {
      setupThemeToggle();
    }
  }

  function setHeaderInfo(profile) {
    const avatar = document.getElementById("sidebarAvatar");
    const name = document.getElementById("sidebarStudentName");
    const roll = document.getElementById("sidebarStudentRoll");
    const greetingName = document.getElementById("greetingName");

    if (avatar && profile?.full_name) {
      avatar.textContent = profile.full_name.charAt(0).toUpperCase();
    }
    if (name && profile?.full_name) {
      name.textContent = profile.full_name;
    }
    if (roll) {
      roll.textContent = profile?.roll ? `Roll: ${profile.roll}` : "Student";
    }
    if (greetingName && profile?.full_name) {
      greetingName.textContent = `Hello, ${profile.full_name.split(" ")[0]} 👋`;
    }
  }

  function switchTab(tab) {
    currentTab = tab;

    // Update sidebar links
    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    // Show tab content
    document.querySelectorAll(".tab-content").forEach((section) => {
      section.classList.toggle("active", section.id === `tab-${tab}`);
    });

    // Close mobile sidebar
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");

    // Refresh data based on tab
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
      case "attendance":
        Attendance.load();
        break;
    }
  }

  function logout() {
    sessionStorage.removeItem("student_token");
    sessionStorage.removeItem("student_info");
    sessionStorage.removeItem("current_screen");
    localStorage.removeItem("student_sidebar_collapsed");
    showScreen("welcome");
  }

  function isTokenExpired(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now();
    } catch {
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return { showScreen, switchTab, logout, getProfile: () => studentProfile };
})();
