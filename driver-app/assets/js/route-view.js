/**
 * Route View Screen Controller
 * Driver app main screen - sidebar, tabs, trip management, navigation
 */
const RouteView = (() => {
  // ════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ════════════════════════════════════════════════════════════════════════

  const TAB_NAMES = ["dashboard", "map", "stops", "trip", "sos"];
  const MAP_INIT_DELAY = 100;
  const TIMER_INTERVAL = 1000;
  const STORAGE_KEY = "active_trip";

  const SOS_TYPES = {
    "sos-emergency-btn": { type: "sos", icon: "🚨", name: "Emergency SOS" },
    "sos-breakdown-btn": { type: "breakdown", icon: "🔧", name: "Breakdown" },
    "sos-deviation-btn": {
      type: "route_deviation",
      icon: "↗️",
      name: "Route Deviation",
    },
    "sos-other-btn": { type: "harsh_braking", icon: "⚠️", name: "Other Issue" },
  };

  const SOS_ICONS = {
    sos: "🚨",
    breakdown: "🔧",
    route_deviation: "↗️",
    harsh_braking: "⚠️",
    overspeeding: "💨",
  };

  // ════════════════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════════════════

  const state = {
    activeTripId: null,
    tripStartTime: null,
    timerInterval: null,
    routeStops: [],
    routeAssignment: null,
    originalStops: [],
    originalAssignment: null,
    attendanceMap: {},
    currentTab: "dashboard",
    mapInitialized: false,
    currentSOSType: null,
  };

  // ════════════════════════════════════════════════════════════════════════
  // DOM HELPERS
  // ════════════════════════════════════════════════════════════════════════

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => document.querySelectorAll(selector);

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function toggleClass(id, className, add) {
    const el = $(id);
    if (el) el.classList.toggle(className, add);
  }

  function show(id) {
    toggleClass(id, "hidden", false);
  }
  function hide(id) {
    toggleClass(id, "hidden", true);
  }

  function on(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  }

  // ════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════

  async function init() {
    setupDriverInfo();
    setupSidebar();
    setupTabs();
    setupLogout();
    setupTripButtons();
    setupTripModals();
    setupSOSButtons();
    setupSOSModal();
    setupSeverityButtons();

    await loadTodayRoute();
  }

  function setupDriverInfo() {
    const driver = JSON.parse(sessionStorage.getItem("driver_info") || "{}");
    const initial = (driver.full_name || "D").charAt(0).toUpperCase();

    setText("sidebar-driver-name", driver.full_name || "Driver");
    setText(
      "sidebar-bus-number",
      driver.bus_number ? `Bus: ${driver.bus_number}` : "No bus",
    );
    setText("top-driver-name", driver.full_name || "Driver");
    setText("sidebar-avatar", initial);
  }

  function setupSidebar() {
    on("sidebar-collapse", "click", () =>
      $("sidebar").classList.toggle("collapsed"),
    );

    on("menu-toggle", "click", () => {
      $("sidebar").classList.add("open");
      $("sidebar-overlay").classList.add("show");
    });

    on("sidebar-overlay", "click", closeMobileSidebar);
  }

  function closeMobileSidebar() {
    $("sidebar")?.classList.remove("open");
    $("sidebar-overlay")?.classList.remove("show");
  }

  function setupTabs() {
    $$(".sidebar-link[data-tab]").forEach((link) => {
      link.addEventListener("click", () => switchTab(link.dataset.tab));
    });
  }

  function setupLogout() {
    on("logout-btn", "click", () => {
      if (state.activeTripId) {
        alert("Please end the active trip before logging out.");
        return;
      }
      App.logout();
    });
  }

  function setupTripButtons() {
    [
      "start-trip-btn",
      "start-trip-btn-alt",
      "start-trip-btn-completed",
    ].forEach((id) => on(id, "click", openModal("start-trip-modal")));

    ["end-trip-btn", "end-trip-btn-alt"].forEach((id) =>
      on(id, "click", openModal("end-trip-modal")),
    );
  }

  function setupTripModals() {
    on("close-start-modal", "click", closeModal("start-trip-modal"));
    on("close-end-modal", "click", closeModal("end-trip-modal"));
    on("cancel-end-btn", "click", closeModal("end-trip-modal"));
    on("confirm-end-btn", "click", handleEndTrip);

    $$(".trip-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleStartTrip(btn.dataset.type));
    });

    setupBackdropClose("start-trip-modal");
    setupBackdropClose("end-trip-modal");
  }

  function setupSOSButtons() {
    Object.entries(SOS_TYPES).forEach(([btnId, sos]) => {
      on(btnId, "click", () => openSOSModal(sos.type, sos.icon, sos.name));
    });
  }

  function setupSOSModal() {
    on("close-sos-modal", "click", closeSOSModal);
    on("cancel-sos-btn", "click", closeSOSModal);
    on("send-sos-btn", "click", handleSendSOS);
    on("sos-confirm-ok", "click", closeModal("sos-confirm-modal"));

    setupBackdropClose("sos-modal");
    setupBackdropClose("sos-confirm-modal");
  }

  function setupSeverityButtons() {
    $$(".severity-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".severity-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODAL HELPERS
  // ════════════════════════════════════════════════════════════════════════

  const openModal = (id) => () => $(id)?.classList.add("show");
  const closeModal = (id) => () => $(id)?.classList.remove("show");

  function setupBackdropClose(modalId) {
    const modal = $(modalId);
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) modal.classList.remove("show");
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB SWITCHING
  // ════════════════════════════════════════════════════════════════════════

  function switchTab(tab) {
    state.currentTab = tab;

    $$(".sidebar-link[data-tab]").forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    $$(".tab-content").forEach((section) => {
      section.classList.toggle("active", section.id === `tab-${tab}`);
    });

    if (tab === "map") {
      handleMapTabSwitch();
    } else if (tab === "sos") {
      loadSOSHistory();
    }

    closeMobileSidebar();
  }

  function handleMapTabSwitch() {
    if (!state.mapInitialized && state.routeStops.length > 0) {
      setTimeout(() => {
        Navigation.initMap(state.routeStops, state.routeAssignment);
        state.mapInitialized = true;
        if (state.activeTripId) Navigation.startNavigation();
      }, MAP_INIT_DELAY);
    } else if (state.mapInitialized) {
      setTimeout(
        () => window.dispatchEvent(new Event("resize")),
        MAP_INIT_DELAY,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ROUTE DIRECTION (Reverse for Drop Trips)
  // ════════════════════════════════════════════════════════════════════════

  function reverseStops(stops) {
    if (!stops || stops.length === 0) return stops;
    return [...stops].reverse().map((stop, idx) => ({
      ...stop,
      sequence_number: idx + 1,
      original_sequence: stop.sequence_number,
    }));
  }

  function reverseWKT(wkt) {
    if (!wkt) return wkt;
    try {
      const content = wkt.match(/\((.*)\)/)[1];
      const reversed = content
        .split(",")
        .map((p) => p.trim())
        .reverse()
        .join(", ");
      return `LINESTRING(${reversed})`;
    } catch {
      return wkt;
    }
  }

  function applyRouteDirection(tripType) {
    state.routeStops = [...state.originalStops];
    state.routeAssignment = { ...state.originalAssignment };

    if (tripType === "drop") {
      state.routeStops = reverseStops(state.originalStops);
      state.routeAssignment.route_path = reverseWKT(
        state.originalAssignment.route_path,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // LOAD & RENDER ROUTE
  // ════════════════════════════════════════════════════════════════════════

  async function loadTodayRoute() {
    try {
      const data = await DriverAPI.getTodayRoute();

      state.originalStops = data.stops;
      state.originalAssignment = data.assignment;
      state.routeStops = data.stops;
      state.routeAssignment = data.assignment;

      const trip = data.active_trip;
      if (trip?.trip_type === "drop" && trip?.status === "ongoing") {
        applyRouteDirection("drop");
      }

      renderRoute(data);

      if (trip?.status === "ongoing") {
        await restoreActiveTrip(trip);
      } else if (trip?.status === "completed") {
        setTripCompleted(trip);
      }
    } catch (err) {
      renderNoRouteState(err);
    }
  }

  function renderRoute(data) {
    renderSummary(data);
    renderStopsList();
    renderQuickStats(data);
  }

  function renderSummary(data) {
    const a = data.assignment;
    $("route-summary").innerHTML = `
      <div class="route-name-header">
        📍 ${a.route_name}
        <span class="shift-badge shift-${a.shift}">${a.shift}</span>
      </div>
      <div class="route-info-grid">
        ${infoItem("Bus", `🚌 ${a.bus_number}`)}
        ${infoItem("Students", `👥 ${data.total_students}`)}
        ${infoItem("Distance", a.total_distance_km ? `${a.total_distance_km} km` : "N/A")}
        ${infoItem("Est. Duration", a.estimated_duration_min ? `${a.estimated_duration_min} min` : "N/A")}
      </div>`;
  }

  function infoItem(label, value) {
    return `
      <div class="route-info-item">
        <span class="info-label">${label}</span>
        <span class="info-value">${value}</span>
      </div>`;
  }

  function renderQuickStats(data) {
    $("quick-stats").innerHTML = `
      ${statCard("📍", data.total_stops, "Total Stops")}
      ${statCard("👥", data.total_students, "Students")}
      ${statCard("🚌", data.assignment.bus_number, "Bus")}
      ${statCard("⏱️", data.assignment.estimated_duration_min || "-", "Minutes Est.")}`;
  }

  function statCard(icon, value, label) {
    return `
      <div class="stat-card">
        <div class="stat-card-icon">${icon}</div>
        <div class="stat-card-value">${value}</div>
        <div class="stat-card-label">${label}</div>
      </div>`;
  }

  function renderStopsList() {
    const container = $("stops-list");
    const countEl = $("stops-count");
    const stops = state.routeStops;

    countEl.textContent = stops.length;

    if (stops.length === 0) {
      container.innerHTML = `<div class="no-route"><p>No stops found.</p></div>`;
      return;
    }

    container.innerHTML = stops.map(renderStopCard).join("");
  }

  function renderStopCard(stop) {
    const status = stopStatuses[stop.id] || {};
    const isVisited = status.visited;
    const isSkipped = status.skipped;

    let statusBadge = "";
    let skipButton = "";

    if (isSkipped) {
      statusBadge = `<span class="stop-status-badge skipped">⚠️ Skipped</span>`;
    } else if (isVisited) {
      statusBadge = `<span class="stop-status-badge visited">✅ Visited</span>`;
    }

    if (activeTripId && !isVisited && !isSkipped) {
      skipButton = `
      <button class="btn-skip-stop" onclick="RouteView.skipStop('${stop.id}')">
        Skip Stop
      </button>`;
    }

    return `
    <div class="stop-card ${isSkipped ? "stop-skipped" : ""} ${isVisited ? "stop-arrived" : ""}" id="stop-${stop.id}">
      <div class="stop-header" onclick="RouteView.toggleStop('${stop.id}')">
        <div class="stop-seq ${isSkipped ? "seq-skipped" : ""}">${stop.sequence_number}</div>
        <div class="stop-info">
          <div class="stop-name ${isSkipped ? "name-skipped" : ""}">${stop.name}</div>
          <div class="stop-time">
            ${stop.scheduled_arrival_time ? `⏰ ${stop.scheduled_arrival_time}` : "No scheduled time"}
          </div>
          ${statusBadge}
        </div>
        <div class="stop-meta">
          ${skipButton}
          <span class="student-count">👥 ${stop.students.length}</span>
          <span class="stop-chevron">▼</span>
        </div>
      </div>
      <div class="students-panel">
        <div class="students-panel-inner">
          ${renderStudents(stop.students, stop.id)}
        </div>
      </div>
    </div>`;
  }

  function renderStudents(students, stopId) {
    if (students.length === 0) {
      return `<div class="no-students">No students at this stop</div>`;
    }
    return students.map((s) => renderStudentItem(s, stopId)).join("");
  }

  function renderStudentItem(student, stopId) {
    const marked = !!state.attendanceMap[student.sid];
    const tripType = state.activeTripId ? getCurrentTripType() : "pickup";
    const checkbox = state.activeTripId
      ? renderAttendanceCheckbox(student.sid, stopId, tripType, marked)
      : "";
    const markedInfo = marked ? renderMarkedInfo(student.sid, tripType) : "";

    return `
      <div class="student-item">
        ${checkbox}
        <div class="student-avatar">${student.full_name.charAt(0).toUpperCase()}</div>
        <div class="student-info">
          <div class="student-name">${student.full_name}</div>
          <div class="student-roll">${student.roll ? `Roll: ${student.roll}` : "No roll number"}</div>
          ${markedInfo}
        </div>
      </div>`;
  }

  function renderAttendanceCheckbox(sid, stopId, tripType, marked) {
    return `
      <label class="attendance-checkbox-wrapper">
        <input type="checkbox" 
               class="attendance-checkbox" 
               ${marked ? "checked" : ""}
               onchange="RouteView.toggleAttendance('${sid}', '${stopId}', '${tripType}', this.checked)" />
        <span class="checkmark"></span>
      </label>`;
  }

  function renderMarkedInfo(sid, tripType) {
    const time = new Date(
      state.attendanceMap[sid].timestamp,
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const action = tripType === "pickup" ? "Picked up" : "Dropped off";
    return `<div class="attendance-time">✓ ${action} at ${time}</div>`;
  }

  function renderNoRouteState(err) {
    const message =
      err.status === 404
        ? "You have no route assigned for today."
        : "Failed to load route.";

    $("route-summary").innerHTML = `
      <div class="no-route">
        <div class="no-route-icon">📋</div>
        <h3>No Route Today</h3>
        <p>${message}</p>
      </div>`;
    $("stops-list").innerHTML = "";
    $("stops-count").textContent = "0";
    $("quick-stats").innerHTML = "";
    $("start-trip-btn").disabled = true;
    $("start-trip-btn-alt").disabled = true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // TRIP STATE MACHINE
  // ════════════════════════════════════════════════════════════════════════

  function setTripState(stateName, trip = null) {
    // Hide all states first
    hide("trip-idle");
    hide("trip-active");
    hide("trip-completed");
    hide("trip-detail-idle");
    hide("trip-detail-active");

    // Show the requested state
    switch (stateName) {
      case "idle":
        showIdleState();
        break;
      case "active":
        showActiveState(trip);
        break;
      case "completed":
        showCompletedState(trip);
        break;
    }
  }

  function showIdleState() {
    show("trip-idle");
    show("trip-detail-idle");
    hide("trip-badge");
    $("start-trip-btn").disabled = false;
    $("start-trip-btn-alt").disabled = false;
  }

  function showActiveState(trip) {
    const tripType = capitalize(trip.trip_type);
    show("trip-active");
    show("trip-detail-active");
    show("trip-badge");
    setText("trip-type-label", tripType);
    setText("trip-detail-type", tripType);
    startTimer();
  }

  function showCompletedState(trip) {
    show("trip-completed");
    show("trip-detail-idle");
    hide("trip-badge");

    const tripType = trip.trip_type ? capitalize(trip.trip_type) : "Trip";
    const endTime = trip.end_time
      ? new Date(trip.end_time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Completed";

    setText("completed-trip-type", tripType);
    setText("completed-trip-time", endTime);
  }

  function setTripActive(trip) {
    state.activeTripId = trip.id;
    state.tripStartTime = new Date(trip.start_time);
    setTripState("active", trip);
    saveTripToSession(trip);
  }

  function setTripIdle() {
    clearTripState();
    setTripState("idle");
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function setTripCompleted(trip) {
    clearTripState();
    setTripState("completed", trip);
    $("start-trip-btn").disabled = false;
    $("start-trip-btn-alt").disabled = false;
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function clearTripState() {
    state.activeTripId = null;
    state.tripStartTime = null;
    state.attendanceMap = {};
    stopTimer();
    GPS.stop();
    GPS.offPosition(onGPSUpdate);
    Navigation.stopNavigation();
  }

  function saveTripToSession(trip) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: trip.id,
        trip_type: trip.trip_type,
        start_time: trip.start_time,
      }),
    );
  }

  async function restoreActiveTrip(trip) {
    setTripActive(trip);
    GPS.start(trip.id);
    GPS.onPosition(onGPSUpdate);
    if (mapInitialized) Navigation.startNavigation();
    await loadAttendance();
    await loadStopStatuses();
    renderStopsList();
  }

  // ════════════════════════════════════════════════════════════════════════
  // TIMER
  // ════════════════════════════════════════════════════════════════════════

  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(updateTimer, TIMER_INTERVAL);
    updateTimer();
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimer() {
    if (!state.tripStartTime) return;
    const elapsed = Math.floor(
      (Date.now() - state.tripStartTime.getTime()) / 1000,
    );
    const time = formatDuration(elapsed);
    setText("trip-timer", time);
    setText("trip-detail-timer", time);
  }

  function formatDuration(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // TRIP HANDLERS
  // ════════════════════════════════════════════════════════════════════════

  async function handleStartTrip(tripType) {
    closeModal("start-trip-modal")();
    $("start-trip-btn").disabled = true;
    $("start-trip-btn-alt").disabled = true;

    try {
      const { trip } = await DriverAPI.startTrip(tripType);

      applyRouteDirection(tripType);
      setTripActive(trip);

      await loadAttendance();
      renderStopsList();

      GPS.start(trip.id);
      GPS.onPosition(onGPSUpdate);

      initOrReinitMap();
      Navigation.startNavigation();
      switchTab("map");
    } catch (err) {
      alert(getStartTripErrorMessage(err));
      $("start-trip-btn").disabled = false;
      $("start-trip-btn-alt").disabled = false;
    }
  }

  function initOrReinitMap() {
    if (state.mapInitialized) {
      Navigation.initMap(state.routeStops, state.routeAssignment);
    } else if (state.routeStops.length > 0) {
      Navigation.initMap(state.routeStops, state.routeAssignment);
      state.mapInitialized = true;
    }
  }

  function getStartTripErrorMessage(err) {
    const messages = {
      409: "A trip is already ongoing",
      404: "No route assignment found",
      0: "No internet connection",
    };
    return messages[err.status] || "Failed to start trip.";
  }

  async function handleEndTrip() {
    if (!state.activeTripId) return;

    const btn = $("confirm-end-btn");
    btn.disabled = true;
    btn.textContent = "Ending...";

    try {
      const { trip } = await DriverAPI.endTrip(state.activeTripId);
      closeModal("end-trip-modal")();
      setTripCompleted(trip);
    } catch (err) {
      alert(getEndTripErrorMessage(err));
    } finally {
      btn.disabled = false;
      btn.textContent = "End Trip";
    }
  }

  function getEndTripErrorMessage(err) {
    if (err.status === 404) return "Trip not found";
    if (err.status === 400) return err.message;
    if (err.status === 0) return "No internet connection";
    return "Failed to end trip.";
  }

  // ════════════════════════════════════════════════════════════════════════
  // GPS BRIDGE
  // ════════════════════════════════════════════════════════════════════════

  function onGPSUpdate(pos) {
    Navigation.updateDriverPosition(pos.latitude, pos.longitude, pos.heading);
    setText("trip-detail-gps", `Active (${pos.accuracy}m)`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // ATTENDANCE
  // ════════════════════════════════════════════════════════════════════════

  async function loadAttendance() {
    if (!state.activeTripId) {
      state.attendanceMap = {};
      return;
    }
    try {
      const data = await DriverAPI.getTripAttendance(state.activeTripId);
      state.attendanceMap = {};
      data.attendance.forEach((r) => (state.attendanceMap[r.student_id] = r));
    } catch (err) {
      console.error("Load attendance error:", err);
      state.attendanceMap = {};
    }
  }

  function getCurrentTripType() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored).trip_type || "pickup" : "pickup";
    } catch {
      return "pickup";
    }
  }

  async function toggleAttendance(studentId, stopId, eventType, isChecked) {
    if (!state.activeTripId) {
      alert("No active trip");
      return;
    }

    try {
      if (isChecked) {
        const { attendance } = await DriverAPI.markAttendance(
          state.activeTripId,
          studentId,
          stopId,
          eventType,
        );
        state.attendanceMap[studentId] = attendance;
      } else {
        const record = state.attendanceMap[studentId];
        if (record) {
          await DriverAPI.unmarkAttendance(record.id);
          delete state.attendanceMap[studentId];
        }
      }
      renderStopsList();
    } catch (err) {
      const msg =
        err.status === 403
          ? "📍 You must be near the stop to mark attendance"
          : err.message || "Failed to update attendance";
      alert(msg);
      await loadAttendance();
      renderStopsList();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // SOS
  // ════════════════════════════════════════════════════════════════════════

  function openSOSModal(type, icon, name) {
    state.currentSOSType = type;
    setText("sos-type-icon", icon);
    setText("sos-type-name", name);
    $("sos-description").value = "";

    $$(".severity-btn").forEach((b) => b.classList.remove("active"));
    $('.severity-btn[data-severity="high"]')?.classList.add("active");

    const pos = GPS.getLastPosition();
    setText(
      "sos-location-text",
      pos
        ? `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`
        : "Location unavailable",
    );

    $("sos-modal").classList.add("show");
  }

  function closeSOSModal() {
    $("sos-modal").classList.remove("show");
    state.currentSOSType = null;
  }

  async function handleSendSOS() {
    if (!state.currentSOSType) return;

    const btn = $("send-sos-btn");
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
      const severity = $(".severity-btn.active")?.dataset.severity || "high";
      const description = $("sos-description").value.trim();
      const pos = GPS.getLastPosition();

      await DriverAPI.sendSOS(
        state.currentSOSType,
        severity,
        {
          description:
            description || `${state.currentSOSType} reported by driver`,
        },
        pos?.latitude || null,
        pos?.longitude || null,
      );

      closeSOSModal();
      $("sos-confirm-modal").classList.add("show");
      loadSOSHistory();
    } catch (err) {
      alert(
        err.status === 0 ? "No internet connection." : "Failed to send alert.",
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "Send Alert";
    }
  }

  async function loadSOSHistory() {
    const container = $("sos-history");
    if (!container) return;

    try {
      const data = await DriverAPI.getSOSHistory();

      if (data.events.length === 0) {
        container.innerHTML = `<div class="sos-no-history">No reports yet</div>`;
        return;
      }

      container.innerHTML = data.events.map(renderSOSHistoryItem).join("");
    } catch {
      container.innerHTML = `<p class="text-muted">Failed to load history</p>`;
    }
  }

  function renderSOSHistoryItem(event) {
    const icon = SOS_ICONS[event.event_type] || "⚠️";
    const type = event.event_type.replace("_", " ");
    const time = new Date(event.occurred_at).toLocaleString();
    return `
      <div class="sos-history-item">
        <div class="sos-history-icon ${event.event_type}">${icon}</div>
        <div class="sos-history-info">
          <div class="sos-history-type">${type}</div>
          <div class="sos-history-time">${time}</div>
        </div>
        <span class="sos-history-severity ${event.severity}">${event.severity}</span>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ════════════════════════════════════════════════════════════════════════

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
  }

  function toggleStop(stopId) {
    $(`stop-${stopId}`)?.classList.toggle("expanded");
  }

  let stopStatuses = {}; // { stopId: { visited, skipped, arrived_at } }

  async function loadStopStatuses() {
    if (!state.activeTripId) {
      stopStatuses = {};
      return;
    }
    try {
      const data = await DriverAPI.getStopStatuses(state.activeTripId);
      stopStatuses = data.statuses || {};
    } catch (err) {
      console.error("Load stop statuses error:", err);
      stopStatuses = {};
    }
  }

  async function skipStop(stopId) {
    if (!activeTripId) {
      alert("No active trip");
      return;
    }

    const reason = prompt("Why is this stop being skipped?", "Route diversion");
    if (reason === null) return; // cancelled

    try {
      await DriverAPI.skipStop(activeTripId, stopId, reason);

      // Reload statuses and re-render
      await loadStopStatuses();
      renderStopsList();

      // Advance navigation past this stop
      Navigation.advancePastStop(stopId);
    } catch (err) {
      alert(err.message || "Failed to skip stop");
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════════

  return { init, toggleStop, toggleAttendance, skipStop };
})();
