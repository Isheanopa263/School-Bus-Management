/**
 * Login Screen Controller
 * Handles form submission, validation, token storage
 */
const LoginScreen = (() => {
  function init() {
    const form = document.getElementById("login-form");
    const toggleBtn = document.getElementById("toggle-password");
    const passwordInput = document.getElementById("password");

    // Toggle password visibility
    toggleBtn.addEventListener("click", () => {
      const isText = passwordInput.type === "text";
      passwordInput.type = isText ? "password" : "text";
      toggleBtn.innerHTML = isText
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
           </svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
           </svg>`;
    });

    // Form submit
    form.addEventListener("submit", handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // Client-side validation
    let valid = true;
    if (!email) {
      showFieldError("email-error", "Email is required");
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      showFieldError("email-error", "Enter a valid email");
      valid = false;
    }
    if (!password) {
      showFieldError("password-error", "Password is required");
      valid = false;
    }
    if (!valid) return;

    // Show loading state
    setLoading(true);

    try {
      const data = await DriverAPI.login(email, password);

      // Store token + driver info
      localStorage.setItem("driver_token", data.token);
      localStorage.setItem("driver_info", JSON.stringify(data.driver));

      // Navigate to route view
      App.showScreen("route");
    } catch (err) {
      const msg =
        err.status === 401
          ? "Invalid email or password"
          : err.status === 403
            ? err.message
            : err.status === 0
              ? "No internet connection"
              : "Login failed. Please try again.";
      showFormError(msg);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    const btn = document.getElementById("login-btn");
    const texts = btn.querySelectorAll(".btn-text");
    const loader = btn.querySelector(".btn-loader");
    btn.disabled = loading;
    texts.forEach((el) => el.classList.toggle("hidden", loading));
    loader.classList.toggle("hidden", !loading);
  }

  function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
    const inputId = id.replace("-error", "");
    const input = document.getElementById(inputId);
    if (input) input.classList.add("error");
  }

  function showFormError(msg) {
    const el = document.getElementById("form-error");
    el.textContent = msg;
    el.classList.add("visible");
  }

  function clearErrors() {
    const formErr = document.getElementById("form-error");
    if (formErr) formErr.classList.remove("visible");
    document
      .querySelectorAll(".field-error")
      .forEach((el) => (el.textContent = ""));
    document
      .querySelectorAll("input.error")
      .forEach((el) => el.classList.remove("error"));
  }

  return { init };
})();
