const API_BASE = "https://school-bus-management-production.up.railway.app/api";

/**
 * Core fetch wrapper for admin dashboard
 * Attaches JWT token, handles errors
 */
async function apiFetch(endpoint, options = {}) {
  const token = sessionStorage.getItem("admin_token");

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

    // 1. Handle 401 Unauthorized
    if (response.status === 401) {
      const isLoginPage =
        window.location.pathname.endsWith("index.html") ||
        window.location.pathname.endsWith("/admin-dashboard/");
      if (!isLoginPage) {
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_user");
        window.location.href = "index.html";
        return null;
      }
      throw { status: 401, message: "Invalid credentials" };
    }

    // 2. Handle 204 No Content (Common for DELETE/PUT)
    if (response.status === 204) {
      return null;
    }

    // 3. Get response text
    const text = await response.text();
    if (!text) return null;

    // 4. Try to parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // If it's not JSON, return as plain text or handle as error
      if (!response.ok) throw { status: response.status, message: text };
      return text;
    }

    // 5. Handle other non-OK responses
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
