/**
 * Theme Toggle Controller
 */
(function () {
  const STORAGE_KEY = "admin_theme";

  // Apply saved theme on load
  const savedTheme = localStorage.getItem(STORAGE_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  // Setup toggle button after DOM loads
  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    updateButton(savedTheme);

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(STORAGE_KEY, next);
      updateButton(next);
    });
  });

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
})();
