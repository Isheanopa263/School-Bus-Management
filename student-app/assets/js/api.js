const API_BASE = "http://localhost:3000/api";

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("student_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 - only redirect if NOT on welcome/login screen
    if (response.status === 401) {
      const currentScreen = localStorage.getItem("current_screen");
      if (
        currentScreen !== "welcome" &&
        currentScreen !== "login" &&
        currentScreen !== "register"
      ) {
        localStorage.removeItem("student_token");
        localStorage.removeItem("student_info");
        App.showScreen("welcome");
        return null;
      }
      throw { status: 401, message: "Invalid credentials" };
    }

    // Handle 204 No Content
    if (response.status === 204) return { success: true };

    // Read as text first
    const text = await response.text();
    if (!text || text.trim().length === 0) return { success: true };

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { message: text };
    }

    if (!response.ok) {
      throw {
        status: response.status,
        message: data?.error || data?.message || "Request failed",
      };
    }

    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      throw { status: 0, message: "No internet connection" };
    }
    throw err;
  }
}

// ── Student API Methods ────────────────────────────────────────────────────

const StudentAPI = {
  // Auth
  login(email, password) {
    return apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register(data) {
    return apiFetch("/auth/register-student", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Profile
  getProfile() {
    return apiFetch("/student/profile");
  },

  updateProfile(data) {
    return apiFetch("/student/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Bus Service
  getRequests() {
    return apiFetch("/student/requests");
  },

  requestBus(home_location, notes) {
    return apiFetch("/bus-requests/request", {
      method: "POST",
      body: JSON.stringify({ home_location, notes }),
    });
  },

  leaveBus() {
    return apiFetch("/student/leave-bus", {
      method: "POST",
    });
  },

  // Live Tracking
  getLiveLocation(busId) {
    return apiFetch(`/live-locations/latest?bus_id=${busId}`);
  },

  // Notifications
  getNotifications() {
    return apiFetch("/student/notifications");
  },

  // Complaints
  submitComplaint(data) {
    return apiFetch("/student/complaints", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  changePassword(currentPassword, newPassword) {
    return apiFetch("/student/change-password", {
      method: "PUT",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },
};
