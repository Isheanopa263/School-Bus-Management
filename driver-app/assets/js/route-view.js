/**
 * Route View Screen Controller
 * Handles sidebar, tabs, route display, trip start/end, navigation
 */
const RouteView = (() => {
  let activeTripId = null;
  let tripStartTime = null;
  let timerInterval = null;
  let routeStops = [];
  let currentTab = "dashboard";
  let mapInitialized = false;

  // GPS → Navigation bridge
  function onGPSUpdate(pos) {
    Navigation.updateDriverPosition(pos.latitude, pos.longitude, pos.heading);
    // Update trip detail GPS status
    const gpsEl = document.getElementById("trip-detail-gps");
    if (gpsEl) gpsEl.textContent = `Active (${pos.accuracy}m)`;
  }

  // ── Init ──────────────────────────────────────────────────────────────
  async function init() {
    const driver = JSON.parse(localStorage.getItem("driver_info") || "{}");

    // Set all driver name/bus displays
    setTextContent("sidebar-driver-name", driver.full_name || "Driver");
    setTextContent(
      "sidebar-bus-number",
      driver.bus_number ? `Bus: ${driver.bus_number}` : "No bus",
    );
    setTextContent("top-driver-name", driver.full_name || "Driver");

    const avatar = document.getElementById("sidebar-avatar");
    if (avatar)
      avatar.textContent = (driver.full_name || "D").charAt(0).toUpperCase();

    // Sidebar collapse
    document
      .getElementById("sidebar-collapse")
      .addEventListener("click", toggleSidebar);

    // Mobile menu
    document
      .getElementById("menu-toggle")
      .addEventListener("click", openMobileSidebar);
    document
      .getElementById("sidebar-overlay")
      .addEventListener("click", closeMobileSidebar);

    // Tab navigation
    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.addEventListener("click", () => switchTab(link.dataset.tab));
    });

    // Logout
    document.getElementById("logout-btn").addEventListener("click", () => {
      if (activeTripId) {
        alert("Please end the active trip before logging out.");
        return;
      }
      App.logout();
    });

    // Trip buttons - Dashboard
    document
      .getElementById("start-trip-btn")
      .addEventListener("click", openStartModal);
    document
      .getElementById("end-trip-btn")
      .addEventListener("click", openEndModal);

    // Trip buttons - Trip tab
    document
      .getElementById("start-trip-btn-alt")
      .addEventListener("click", openStartModal);
    document
      .getElementById("end-trip-btn-alt")
      .addEventListener("click", openEndModal);

    // Start trip from completed state
    document
      .getElementById("start-trip-btn-completed")
      .addEventListener("click", openStartModal);

    // Modal: start trip
    document
      .getElementById("close-start-modal")
      .addEventListener("click", closeStartModal);
    document.querySelectorAll(".trip-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleStartTrip(btn.dataset.type));
    });

    // Modal: end trip
    document
      .getElementById("close-end-modal")
      .addEventListener("click", closeEndModal);
    document
      .getElementById("cancel-end-btn")
      .addEventListener("click", closeEndModal);
    document
      .getElementById("confirm-end-btn")
      .addEventListener("click", handleEndTrip);
    // Backdrop close
    document
      .getElementById("start-trip-modal")
      .addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeStartModal();
      });
    document.getElementById("end-trip-modal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeEndModal();
    });

    // SOS buttons
    document
      .getElementById("sos-emergency-btn")
      .addEventListener("click", () =>
        openSOSModal("sos", "🚨", "Emergency SOS"),
      );
    document
      .getElementById("sos-breakdown-btn")
      .addEventListener("click", () =>
        openSOSModal("breakdown", "🔧", "Breakdown"),
      );
    document
      .getElementById("sos-deviation-btn")
      .addEventListener("click", () =>
        openSOSModal("route_deviation", "↗️", "Route Deviation"),
      );
    document
      .getElementById("sos-other-btn")
      .addEventListener("click", () =>
        openSOSModal("harsh_braking", "⚠️", "Other Issue"),
      );

    // SOS modal controls
    document
      .getElementById("close-sos-modal")
      .addEventListener("click", closeSOSModal);
    document
      .getElementById("cancel-sos-btn")
      .addEventListener("click", closeSOSModal);
    document
      .getElementById("send-sos-btn")
      .addEventListener("click", handleSendSOS);
    document.getElementById("sos-confirm-ok").addEventListener("click", () => {
      document.getElementById("sos-confirm-modal").classList.remove("show");
    });

    // SOS modal backdrop
    document.getElementById("sos-modal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeSOSModal();
    });
    document
      .getElementById("sos-confirm-modal")
      .addEventListener("click", (e) => {
        if (e.target === e.currentTarget)
          e.currentTarget.classList.remove("show");
      });

    // Severity buttons
    document.querySelectorAll(".severity-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".severity-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    // Load route
    await loadTodayRoute();
  }

  // ── Sidebar ───────────────────────────────────────────────────────────
  function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("collapsed");
  }

  function openMobileSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebar-overlay").classList.add("show");
  }

  function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("show");
  }

  // ── Tab Switching ─────────────────────────────────────────────────────
  function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    document.querySelectorAll(".tab-content").forEach((section) => {
      section.classList.toggle("active", section.id === `tab-${tab}`);
    });

    if (tab === "map" && !mapInitialized && routeStops.length > 0) {
      setTimeout(() => {
        Navigation.initMap(routeStops);
        mapInitialized = true;
        if (activeTripId) Navigation.startNavigation();
      }, 100);
    }

    if (tab === "map" && mapInitialized) {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 100);
    }

    // Load SOS history when tab opens
    if (tab === "sos") {
      loadSOSHistory();
    }

    closeMobileSidebar();
  }

  // ── Load Route ────────────────────────────────────────────────────────
  async function loadTodayRoute() {
    const summaryEl = document.getElementById("route-summary");
    const stopsEl = document.getElementById("stops-list");
    const countEl = document.getElementById("stops-count");
    const statsEl = document.getElementById("quick-stats");

    try {
      const data = await DriverAPI.getTodayRoute();
      routeStops = data.stops;
      renderSummary(summaryEl, data);
      renderStops(stopsEl, countEl, data.stops);
      renderQuickStats(statsEl, data);

      // Restore active trip state
      if (data.active_trip) {
        if (data.active_trip.status === "ongoing") {
          restoreActiveTrip(data.active_trip);
        } else if (data.active_trip.status === "completed") {
          setTripCompleted(data.active_trip);
        }
      }
    } catch (err) {
      summaryEl.innerHTML = `
        <div class="no-route">
          <div class="no-route-icon">📋</div>
          <h3>No Route Today</h3>
          <p>${
            err.status === 404
              ? "You have no route assigned for today."
              : "Failed to load route. Check your connection."
          }</p>
        </div>`;
      stopsEl.innerHTML = "";
      countEl.textContent = "0";
      statsEl.innerHTML = "";
      document.getElementById("start-trip-btn").disabled = true;
      document.getElementById("start-trip-btn-alt").disabled = true;
    }
  }

  // ── Render Summary ────────────────────────────────────────────────────
  function renderSummary(container, data) {
    const { assignment } = data;
    const shiftClass = `shift-${assignment.shift}`;

    container.innerHTML = `
      <div class="route-name-header">
        📍 ${assignment.route_name}
        <span class="shift-badge ${shiftClass}">${assignment.shift}</span>
      </div>
      <div class="route-info-grid">
        <div class="route-info-item">
          <span class="info-label">Bus</span>
          <span class="info-value">🚌 ${assignment.bus_number}</span>
        </div>
        <div class="route-info-item">
          <span class="info-label">Students</span>
          <span class="info-value">👥 ${data.total_students}</span>
        </div>
        <div class="route-info-item">
          <span class="info-label">Distance</span>
          <span class="info-value">${assignment.total_distance_km ? `${assignment.total_distance_km} km` : "N/A"}</span>
        </div>
        <div class="route-info-item">
          <span class="info-label">Est. Duration</span>
          <span class="info-value">${assignment.estimated_duration_min ? `${assignment.estimated_duration_min} min` : "N/A"}</span>
        </div>
      </div>`;
  }

  // ── Quick Stats ───────────────────────────────────────────────────────
  function renderQuickStats(container, data) {
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-icon">📍</div>
        <div class="stat-card-value">${data.total_stops}</div>
        <div class="stat-card-label">Total Stops</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">👥</div>
        <div class="stat-card-value">${data.total_students}</div>
        <div class="stat-card-label">Students</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">🚌</div>
        <div class="stat-card-value">${data.assignment.bus_number}</div>
        <div class="stat-card-label">Bus</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">⏱️</div>
        <div class="stat-card-value">${data.assignment.estimated_duration_min || "-"}</div>
        <div class="stat-card-label">Minutes Est.</div>
      </div>`;
  }

  // ── Render Stops ──────────────────────────────────────────────────────
  function renderStops(container, countEl, stops) {
    countEl.textContent = stops.length;

    if (stops.length === 0) {
      container.innerHTML = `<div class="no-route"><p>No stops found.</p></div>`;
      return;
    }

    container.innerHTML = stops
      .map(
        (stop) => `
      <div class="stop-card" id="stop-${stop.id}">
        <div class="stop-header" onclick="RouteView.toggleStop('${stop.id}')">
          <div class="stop-seq">${stop.sequence_number}</div>
          <div class="stop-info">
            <div class="stop-name">${stop.name}</div>
            <div class="stop-time">
              ${stop.scheduled_arrival_time ? `⏰ ${stop.scheduled_arrival_time}` : "No scheduled time"}
            </div>
          </div>
          <div class="stop-meta">
            <span class="student-count">👥 ${stop.students.length}</span>
            <span class="stop-chevron">▼</span>
          </div>
        </div>
        <div class="students-panel">
          <div class="students-panel-inner">
            ${renderStudents(stop.students)}
          </div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function renderStudents(students) {
    if (students.length === 0) {
      return `<div class="no-students">No students at this stop</div>`;
    }
    return students
      .map(
        (s) => `
      <div class="student-item">
        <div class="student-avatar">${s.full_name.charAt(0).toUpperCase()}</div>
        <div class="student-info">
          <div class="student-name">${s.full_name}</div>
          <div class="student-roll">${s.roll ? `Roll: ${s.roll}` : "No roll number"}</div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // ── Trip State ────────────────────────────────────────────────────────
  function setTripActive(trip) {
    activeTripId = trip.id;
    tripStartTime = new Date(trip.start_time);
    const tripType =
      trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1);

    // Dashboard trip bar
    document.getElementById("trip-idle").classList.add("hidden");
    document.getElementById("trip-active").classList.remove("hidden");
    document.getElementById("trip-type-label").textContent = tripType;

    // Trip tab detail
    document.getElementById("trip-detail-idle").classList.add("hidden");
    document.getElementById("trip-detail-active").classList.remove("hidden");
    document.getElementById("trip-detail-type").textContent = tripType;

    // Show LIVE badge on trip nav
    const badge = document.getElementById("trip-badge");
    if (badge) badge.classList.remove("hidden");

    startTimer();

    localStorage.setItem(
      "active_trip",
      JSON.stringify({
        id: trip.id,
        trip_type: trip.trip_type,
        start_time: trip.start_time,
      }),
    );
  }

  function setTripIdle() {
    activeTripId = null;
    tripStartTime = null;
    stopTimer();
    GPS.stop();
    GPS.offPosition(onGPSUpdate);
    Navigation.stopNavigation();

    // Dashboard trip bar
    document.getElementById("trip-active").classList.add("hidden");
    document.getElementById("trip-idle").classList.remove("hidden");

    // Trip tab detail
    document.getElementById("trip-detail-active").classList.add("hidden");
    document.getElementById("trip-detail-idle").classList.remove("hidden");

    // Hide LIVE badge
    const badge = document.getElementById("trip-badge");
    if (badge) badge.classList.add("hidden");

    // Re-enable start buttons
    document.getElementById("start-trip-btn").disabled = false;
    document.getElementById("start-trip-btn-alt").disabled = false;

    localStorage.removeItem("active_trip");
  }

  function restoreActiveTrip(trip) {
    setTripActive(trip);
    GPS.start(trip.id);
    GPS.onPosition(onGPSUpdate);
    if (mapInitialized) Navigation.startNavigation();
  }

  // ── Timer ─────────────────────────────────────────────────────────────
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimer() {
    if (!tripStartTime) return;
    const elapsed = Math.floor((Date.now() - tripStartTime.getTime()) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    const time = `${h}:${m}:${s}`;

    setTextContent("trip-timer", time);
    setTextContent("trip-detail-timer", time);
  }

  // ── Modals ────────────────────────────────────────────────────────────
  function openStartModal() {
    document.getElementById("start-trip-modal").classList.add("show");
  }
  function closeStartModal() {
    document.getElementById("start-trip-modal").classList.remove("show");
  }
  function openEndModal() {
    document.getElementById("end-trip-modal").classList.add("show");
  }
  function closeEndModal() {
    document.getElementById("end-trip-modal").classList.remove("show");
  }

  // ── Handlers ──────────────────────────────────────────────────────────
  async function handleStartTrip(tripType) {
    closeStartModal();
    document.getElementById("start-trip-btn").disabled = true;
    document.getElementById("start-trip-btn-alt").disabled = true;

    try {
      const data = await DriverAPI.startTrip(tripType);
      setTripActive(data.trip);
      GPS.start(data.trip.id);
      GPS.onPosition(onGPSUpdate);

      // Init map if on map tab or hasn't been initialized
      if (!mapInitialized && routeStops.length > 0) {
        Navigation.initMap(routeStops);
        mapInitialized = true;
      }
      Navigation.startNavigation();

      // Switch to map tab
      switchTab("map");
    } catch (err) {
      const msg =
        err.status === 409
          ? "A trip is already ongoing"
          : err.status === 404
            ? "No route assignment found"
            : err.status === 0
              ? "No internet connection"
              : "Failed to start trip.";
      alert(msg);
      document.getElementById("start-trip-btn").disabled = false;
      document.getElementById("start-trip-btn-alt").disabled = false;
    }
  }

  async function handleEndTrip() {
    if (!activeTripId) return;

    const confirmBtn = document.getElementById("confirm-end-btn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Ending...";

    try {
      const result = await DriverAPI.endTrip(activeTripId);
      closeEndModal();
      setTripCompleted(result.trip);
    } catch (err) {
      const msg =
        err.status === 404
          ? "Trip not found"
          : err.status === 400
            ? err.message
            : err.status === 0
              ? "No internet connection"
              : "Failed to end trip.";
      alert(msg);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "End Trip";
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function toggleStop(stopId) {
    const card = document.getElementById(`stop-${stopId}`);
    if (card) card.classList.toggle("expanded");
  }

  function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── SOS Functions ─────────────────────────────────────────────────────
  let currentSOSType = null;

  function openSOSModal(type, icon, name) {
    currentSOSType = type;
    document.getElementById("sos-type-icon").textContent = icon;
    document.getElementById("sos-type-name").textContent = name;
    document.getElementById("sos-description").value = "";

    // Reset severity to high
    document
      .querySelectorAll(".severity-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.severity-btn[data-severity="high"]')
      .classList.add("active");

    // Get current location
    const pos = GPS.getLastPosition();
    const locText = document.getElementById("sos-location-text");
    if (pos) {
      locText.textContent = `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
    } else {
      locText.textContent = "Location unavailable";
    }

    document.getElementById("sos-modal").classList.add("show");
  }

  function closeSOSModal() {
    document.getElementById("sos-modal").classList.remove("show");
    currentSOSType = null;
  }

  async function handleSendSOS() {
    if (!currentSOSType) return;

    const sendBtn = document.getElementById("send-sos-btn");
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    const severity =
      document.querySelector(".severity-btn.active")?.dataset.severity ||
      "high";
    const description = document.getElementById("sos-description").value.trim();
    const pos = GPS.getLastPosition();

    try {
      await DriverAPI.sendSOS(
        currentSOSType,
        severity,
        { description: description || `${currentSOSType} reported by driver` },
        pos?.latitude || null,
        pos?.longitude || null,
      );

      closeSOSModal();

      // Show confirmation
      document.getElementById("sos-confirm-modal").classList.add("show");

      // Reload SOS history
      loadSOSHistory();
    } catch (err) {
      const msg =
        err.status === 0
          ? "No internet connection. Please try again."
          : "Failed to send alert. Please try again.";
      alert(msg);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send Alert";
    }
  }

  async function loadSOSHistory() {
    const container = document.getElementById("sos-history");
    if (!container) return;

    try {
      const data = await DriverAPI.getSOSHistory();

      if (data.events.length === 0) {
        container.innerHTML = `<div class="sos-no-history">No reports yet</div>`;
        return;
      }

      const iconMap = {
        sos: "🚨",
        breakdown: "🔧",
        route_deviation: "↗️",
        harsh_braking: "⚠️",
        overspeeding: "💨",
      };

      container.innerHTML = data.events
        .map(
          (event) => `
      <div class="sos-history-item">
        <div class="sos-history-icon ${event.event_type}">
          ${iconMap[event.event_type] || "⚠️"}
        </div>
        <div class="sos-history-info">
          <div class="sos-history-type">
            ${event.event_type.replace("_", " ")}
          </div>
          <div class="sos-history-time">
            ${new Date(event.occurred_at).toLocaleString()}
          </div>
        </div>
        <span class="sos-history-severity ${event.severity}">
          ${event.severity}
        </span>
      </div>
    `,
        )
        .join("");
    } catch (err) {
      container.innerHTML = `<p class="text-muted">Failed to load history</p>`;
    }
  }

  function setTripCompleted(trip) {
    activeTripId = null;
    tripStartTime = null;
    stopTimer();
    GPS.stop();

    document.getElementById("trip-idle").classList.add("hidden");
    document.getElementById("trip-active").classList.add("hidden");
    document.getElementById("trip-completed").classList.remove("hidden");

    document.getElementById("completed-trip-type").textContent = trip.trip_type
      ? trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1)
      : "Trip";

    document.getElementById("completed-trip-time").textContent = trip.end_time
      ? new Date(trip.end_time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Completed";

    localStorage.removeItem("active_trip");
  }

  return { init, toggleStop };
})();
