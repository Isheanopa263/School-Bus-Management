(function () {
  const STORAGE_KEY = "driver_theme";

  const savedTheme = localStorage.getItem(STORAGE_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

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

    if (theme === "light") {
      iconDark?.classList.add("hidden");
      iconLight?.classList.remove("hidden");
    } else {
      iconDark?.classList.remove("hidden");
      iconLight?.classList.add("hidden");
    }
  }

  window.setupThemeToggle = setupToggle;
})();
