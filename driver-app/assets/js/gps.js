/**
 * GPS Tracking Controller
 * Manages device GPS, sends location to server during active trips
 */
const GPS = (() => {
  let watchId = null;
  let sendInterval = null;
  let currentTripId = null;
  let lastPosition = null;
  let isTracking = false;
  let errorCount = 0;
  let onPositionCallbacks = [];

  const SEND_INTERVAL_MS = 5000;
  const MAX_ERRORS = 10;
  const MIN_ACCURACY_M = 50;

  // ── Start Tracking ────────────────────────────────────────────────────
  function start(tripId) {
    if (isTracking) stop();

    currentTripId = tripId;
    isTracking = true;
    errorCount = 0;

    console.log("[GPS] Starting tracking for trip:", tripId);
    updateStatusUI("acquiring", "Acquiring GPS signal...");

    if (!navigator.geolocation) {
      console.error("[GPS] Geolocation not supported");
      updateStatusUI("error", "GPS not supported on this device");
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      onPositionSuccess,
      onPositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    );

    sendInterval = setInterval(sendLocationToServer, SEND_INTERVAL_MS);
  }

  // ── Stop Tracking ─────────────────────────────────────────────────────
  function stop() {
    console.log("[GPS] Stopping tracking");
    isTracking = false;
    currentTripId = null;
    lastPosition = null;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (sendInterval) {
      clearInterval(sendInterval);
      sendInterval = null;
    }

    updateStatusUI("off", "");
  }

  // ── Position Callbacks ─────────────────────────────────────────────────
  function onPositionSuccess(position) {
    const { latitude, longitude, speed, heading, accuracy } = position.coords;

    if (accuracy > MIN_ACCURACY_M) {
      console.warn(`[GPS] Low accuracy: ${accuracy.toFixed(0)}m, skipping`);
      return;
    }

    lastPosition = {
      latitude,
      longitude,
      speed: speed !== null ? Math.round(speed * 3.6 * 10) / 10 : 0,
      heading: heading !== null ? Math.round(heading * 10) / 10 : 0,
      accuracy: Math.round(accuracy),
      timestamp: Date.now(),
    };

    updateStatusUI(
      "active",
      `GPS Active • Accuracy: ${lastPosition.accuracy}m`,
    );

    // Notify all listeners (Navigation uses this)
    onPositionCallbacks.forEach((cb) => {
      try {
        cb(lastPosition);
      } catch (err) {
        console.error("[GPS] Callback error:", err);
      }
    });
  }

  function onPositionError(error) {
    console.error("[GPS] Position error:", error.message);

    switch (error.code) {
      case error.PERMISSION_DENIED:
        updateStatusUI(
          "error",
          "GPS permission denied. Enable location access.",
        );
        stop();
        break;
      case error.POSITION_UNAVAILABLE:
        updateStatusUI("error", "GPS signal unavailable");
        break;
      case error.TIMEOUT:
        updateStatusUI("error", "GPS signal timeout, retrying...");
        break;
    }
  }

  // ── Send To Server ─────────────────────────────────────────────────────
  async function sendLocationToServer() {
    if (!isTracking || !lastPosition || !currentTripId) return;

    if (Date.now() - lastPosition.timestamp > 15000) {
      console.warn("[GPS] Position data is stale, skipping send");
      return;
    }

    try {
      await DriverAPI.updateLocation(
        currentTripId,
        lastPosition.latitude,
        lastPosition.longitude,
        lastPosition.speed,
        lastPosition.heading,
      );

      errorCount = 0;
      console.log(
        `[GPS] Sent: ${lastPosition.latitude.toFixed(5)}, ${lastPosition.longitude.toFixed(5)} | ` +
          `Speed: ${lastPosition.speed} km/h | Accuracy: ${lastPosition.accuracy}m`,
      );
    } catch (err) {
      errorCount++;
      console.error(
        `[GPS] Send failed (${errorCount}/${MAX_ERRORS}):`,
        err.message,
      );

      if (errorCount >= MAX_ERRORS) {
        console.error("[GPS] Too many errors, stopping location sends");
        updateStatusUI("error", "Connection lost. Location not being sent.");
        clearInterval(sendInterval);
        sendInterval = null;

        setTimeout(() => {
          if (isTracking) {
            errorCount = 0;
            sendInterval = setInterval(sendLocationToServer, SEND_INTERVAL_MS);
            console.log("[GPS] Retrying location sends...");
          }
        }, 30000);
      }
    }
  }

  // ── Status UI ──────────────────────────────────────────────────────────
  function updateStatusUI(status, message) {
    const el = document.getElementById("gps-status");
    if (!el) return;

    const dot = el.querySelector(".gps-status-dot");
    const label = el.querySelector(".gps-status-label");

    if (!dot || !label) return;

    dot.className = "gps-status-dot";

    switch (status) {
      case "active":
        dot.classList.add("gps-active");
        el.classList.remove("hidden");
        break;
      case "acquiring":
        dot.classList.add("gps-acquiring");
        el.classList.remove("hidden");
        break;
      case "error":
        dot.classList.add("gps-error");
        el.classList.remove("hidden");
        break;
      case "off":
        el.classList.add("hidden");
        return;
    }

    label.textContent = message;
  }

  // ── Listener Registration ──────────────────────────────────────────────
  function onPosition(callback) {
    onPositionCallbacks.push(callback);
  }

  function offPosition(callback) {
    onPositionCallbacks = onPositionCallbacks.filter((cb) => cb !== callback);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    start,
    stop,
    isActive: () => isTracking,
    getLastPosition: () => lastPosition,
    onPosition,
    offPosition,
  };
})();
