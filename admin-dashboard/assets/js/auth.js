// assets/js/auth.js

const API_BASE_URL = "http://localhost:3000";

// Check if user is logged in
function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/admin-dashboard/index.html";
    return false;
  }
  return true;
}

// API fetch wrapper with auth header
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const isLoginEndpoint = endpoint.includes("/api/auth/login");
  const isOnLoginPage = window.location.pathname.includes("index.html");

  if (res.status === 401 && !isLoginEndpoint && !isOnLoginPage) {
    localStorage.removeItem("token");
    window.location.href = "/admin-dashboard/index.html";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Logout
function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/admin-dashboard/index.html";
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLogout);
} else {
  initLogout();
}

// Handle login form submit
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const errorEl = document.getElementById("errorMessage");
  const btn = e.target.querySelector('button[type="submit"]');
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  if (errorEl) {
    errorEl.classList.remove("show");
    errorEl.textContent = "";
  }

  const originalBtnHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>Signing in...</span>";

  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    localStorage.setItem("token", res.token);
    if (res.user) {
      localStorage.setItem("user", JSON.stringify(res.user));
    }
    window.location.href = "/admin-dashboard/dashboard.html";
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Invalid email or password";
      errorEl.classList.add("show");
    }
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
    e.target.style.animation = "shake 0.3s";
    setTimeout(() => {
      e.target.style.animation = "";
    }, 300);
  }
});
