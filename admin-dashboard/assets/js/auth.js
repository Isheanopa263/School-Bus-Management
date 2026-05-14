/**
 * Auth handler for admin dashboard
 * Login page: handles form submit
 * Other pages: checks token, handles logout
 */
(function () {
  const isLoginPage =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/admin-dashboard/");

  if (isLoginPage) {
    // ── Login Page ────────────────────────────────────────────────────────
    const token = localStorage.getItem("admin_token");
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
          btn.innerHTML = `<span>Sign in</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>`;
          return;
        }

        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_user", JSON.stringify(data.user));
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
        btn.innerHTML = `<span>Sign in</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>`;
      }
    });
  } else {
    // ── Protected Pages ───────────────────────────────────────────────────
    const token = localStorage.getItem("admin_token");
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        window.location.href = "index.html";
      });
    }
  }
})();
