const API_BASE = "/api";

export async function apiFetch(endpoint, options = {}) {
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

    if (response.status === 401) {
      sessionStorage.removeItem("admin_token");
      sessionStorage.removeItem("admin_user");
      if (!window.location.pathname.includes("/admin-dashboard/login")) {
        window.location.href = "/admin-dashboard/login";
      }
      return null;
    }

    if (response.status === 204) return { success: true };

    const text = await response.text();
    if (!text) return { success: true };

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      throw {
        status: response.status,
        message: data?.error || "Request failed",
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
