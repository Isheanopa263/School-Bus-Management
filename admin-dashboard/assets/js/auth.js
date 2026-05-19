/**
 * Auth handler for admin dashboard
 * Login page: handles form submit
 * Other pages: checks token, handles logout
 */
(function () {
  function isReloadNavigation() {
    try {
      const nav = performance.getEntriesByType("navigation");
      if (nav && nav.length) return nav[0].type === "reload";
      return performance.navigation && performance.navigation.type === 1;
    } catch {
      return false;
    }
  }

  // Logout on refresh
  if (isReloadNavigation()) {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_user");
  }

  const isLoginPage =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/admin-dashboard/");

  if (isLoginPage) {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      window.location.href = "dashboard.html";
      return;
    }

    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("errorMessage");
      const btn = document.getElementById("loginBtn");

      errorEl.classList.remove("show");

      if (!email || !password) {
        errorEl.textContent = "Email and password are required";
        errorEl.classList.add("show");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span>Signing in...</span>`;

      try {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        if (data.user.role !== "admin") {
          errorEl.textContent = "Access restricted to administrators";
          errorEl.classList.add("show");
          btn.disabled = false;
          btn.innerHTML = `<span>Sign in</span>`;
          return;
        }

        sessionStorage.setItem("admin_token", data.token);
        sessionStorage.setItem("admin_user", JSON.stringify(data.user));
        window.location.href = "dashboard.html";
      } catch (err) {
        errorEl.textContent =
          err.status === 401
            ? "Invalid email or password"
            : err.status === 0
              ? "Cannot connect to server"
              : "Login failed. Please try again.";
        errorEl.classList.add("show");
        btn.disabled = false;
        btn.innerHTML = `<span>Sign in</span>`;
      }
    });
  } else {
    const token = sessionStorage.getItem("admin_token");
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_user");
        window.location.href = "index.html";
      });
    }
  }
})();
