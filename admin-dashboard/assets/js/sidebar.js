/**
 * Sidebar controller - shared across all admin pages
 */
(function () {
  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("sidebarCollapse");
  const menuToggle = document.getElementById("menuToggle");
  const overlay = document.getElementById("sidebarOverlay");

  if (!sidebar) return;

  // Desktop collapse
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      sessionStorage.setItem(
        "sidebar_collapsed",
        sidebar.classList.contains("collapsed"),
      );
    });

    // Restore state
    if (sessionStorage.getItem("sidebar_collapsed") === "true") {
      sidebar.classList.add("collapsed");
    }
  }

  // Mobile menu
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.add("open");
      if (overlay) overlay.classList.add("show");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  // Set active nav link based on current page
  const currentPage =
    window.location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll(".sidebar-link[data-page]").forEach((link) => {
    if (link.dataset.page === currentPage) {
      link.classList.add("active");
    }
  });
})();
