const API_BASE = "http://localhost:3000/api";

/**
 * Core fetch wrapper
 * - Attaches JWT token automatically
 * - Returns parsed JSON or throws error object
 */
async function apiFetch(endpoint, options = {}) {
  const token = sessionStorage.getItem("driver_token");

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

    const data = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        message: data.error || "Request failed",
      };
    }

    return data;
  } catch (err) {
    // Network error (offline)
    if (err instanceof TypeError) {
      throw { status: 0, message: "No internet connection" };
    }
    throw err;
  }
}

// ── Driver API calls ───────────────────────────────────────────────────────

const DriverAPI = {
  login(email, password) {
    return apiFetch("/driver/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getTodayRoute() {
    return apiFetch("/driver/route/today");
  },

  startTrip(trip_type) {
    return apiFetch("/driver/trips/start", {
      method: "POST",
      body: JSON.stringify({ trip_type }),
    });
  },

  endTrip(tripId) {
    return apiFetch(`/driver/trips/${tripId}/end`, {
      method: "POST",
    });
  },

  updateLocation(tripId, latitude, longitude, speed, heading) {
    return apiFetch("/driver/location/update", {
      method: "POST",
      body: JSON.stringify({
        trip_id: tripId,
        latitude,
        longitude,
        speed,
        heading,
      }),
    });
  },

  getLocationHistory(tripId) {
    return apiFetch(`/driver/location/history/${tripId}`);
  },

  // ── SOS ────────────────────────────────────────────────────────────────
  sendSOS(eventType, severity, details, latitude, longitude) {
    return apiFetch("/driver/sos", {
      method: "POST",
      body: JSON.stringify({
        event_type: eventType,
        severity,
        details,
        latitude,
        longitude,
      }),
    });
  },

  getSOSHistory() {
    return apiFetch("/driver/sos/history");
  },
};
