/**
 * Theme Toggle Controller - Driver App
 */
(function () {
  const STORAGE_KEY = "driver_theme";

  // Apply saved theme immediately
  const savedTheme = localStorage.getItem(STORAGE_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  // Re-attach toggle after every screen change
  function setupToggle() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    const current = document.documentElement.getAttribute("data-theme");
    updateButton(current);

    toggle.onclick = (e) => {
      e.preventDefault();
      const c = document.documentElement.getAttribute("data-theme");
      const next = c === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(STORAGE_KEY, next);
      updateButton(next);
    };
  }

  function updateButton(theme) {
    const iconDark = document.getElementById("themeIconDark");
    const iconLight = document.getElementById("themeIconLight");
    const text = document.getElementById("themeText");

    if (theme === "light") {
      iconDark?.classList.add("hidden");
      iconLight?.classList.remove("hidden");
      if (text) text.textContent = "Dark Mode";
    } else {
      iconDark?.classList.remove("hidden");
      iconLight?.classList.add("hidden");
      if (text) text.textContent = "Light Mode";
    }
  }

  // Expose globally so app.js can call after screen change
  window.setupThemeToggle = setupToggle;
})();
