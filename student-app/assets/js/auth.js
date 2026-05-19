/**
 * Auth Controller - Login & Register
 */
const Auth = (() => {
  function initLogin() {
    document.getElementById("loginBtn").addEventListener("click", handleLogin);
    document
      .getElementById("loginToRegister")
      .addEventListener("click", () => App.showScreen("register"));

    document
      .getElementById("loginPassword")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLogin();
      });
  }

  async function handleLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");
    const btnText = document.getElementById("loginBtnText");

    errorEl.classList.remove("visible");

    if (!email || !password) {
      errorEl.textContent = "Email and password are required";
      errorEl.classList.add("visible");
      return;
    }

    btn.disabled = true;
    btnText.textContent = "Signing in...";

    try {
      const data = await StudentAPI.login(email, password);
      if (data.user.role !== "student") {
        errorEl.textContent = "This app is for students only";
        errorEl.classList.add("visible");
        return;
      }
      sessionStorage.setItem("student_token", data.token);
      sessionStorage.setItem("student_info", JSON.stringify(data.user));
      App.showScreen("main");
    } catch (err) {
      errorEl.textContent =
        err.status === 401
          ? "Invalid email or password"
          : err.status === 0
            ? "No internet connection"
            : err.message || "Login failed";
      errorEl.classList.add("visible");
    } finally {
      btn.disabled = false;
      btnText.textContent = "Sign In";
    }
  }

  function initRegister() {
    document
      .getElementById("registerBtn")
      .addEventListener("click", handleRegister);
    document
      .getElementById("registerToLogin")
      .addEventListener("click", () => App.showScreen("login"));
  }

  async function handleRegister() {
    const name = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const roll = document.getElementById("regRoll").value.trim();
    const emergency = document.getElementById("regEmergency").value.trim();
    const errorEl = document.getElementById("registerError");
    const btn = document.getElementById("registerBtn");
    const btnText = document.getElementById("registerBtnText");

    errorEl.classList.remove("visible");

    if (!name || !phone || !password) {
      errorEl.textContent = "Name, phone and password are required";
      errorEl.classList.add("visible");
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = "Password must be at least 6 characters";
      errorEl.classList.add("visible");
      return;
    }

    btn.disabled = true;
    btnText.textContent = "Creating account...";

    try {
      const data = await StudentAPI.register({
        full_name: name,
        phone,
        email: email || undefined,
        password,
        roll: roll || undefined,
        emergency_contact_phone: emergency || undefined,
      });

      sessionStorage.setItem("student_token", data.token);
      sessionStorage.setItem("student_info", JSON.stringify(data.user));
      App.showScreen("main");
    } catch (err) {
      errorEl.textContent =
        err.status === 409
          ? "Phone or email already registered"
          : err.status === 0
            ? "No internet connection"
            : err.message || "Registration failed";
      errorEl.classList.add("visible");
    } finally {
      btn.disabled = false;
      btnText.textContent = "Create Account";
    }
  }

  return { initLogin, initRegister };
})();
