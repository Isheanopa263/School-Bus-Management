/**
 * Route View Screen Controller
 * Displays today's route, stops, and students
 */
const RouteView = (() => {
  async function init() {
    const driver = JSON.parse(localStorage.getItem("driver_info") || "{}");

    // Set header info
    document.getElementById("header-driver-name").textContent =
      driver.full_name || "Driver";
    document.getElementById("header-bus-number").textContent = driver.bus_number
      ? `Bus: ${driver.bus_number}`
      : "No bus assigned";

    // Logout button
    document.getElementById("logout-btn").addEventListener("click", () => {
      App.logout();
    });

    // Load route data
    await loadTodayRoute();
  }

  async function loadTodayRoute() {
    const summaryEl = document.getElementById("route-summary");
    const stopsEl = document.getElementById("stops-list");
    const countEl = document.getElementById("stops-count");

    try {
      const data = await DriverAPI.getTodayRoute();
      renderSummary(summaryEl, data);
      renderStops(stopsEl, countEl, data.stops);
    } catch (err) {
      // No route assigned or error
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
    }
  }

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
          <span class="info-value">
            ${
              assignment.total_distance_km
                ? `${assignment.total_distance_km} km`
                : "N/A"
            }
          </span>
        </div>
        <div class="route-info-item">
          <span class="info-label">Est. Duration</span>
          <span class="info-value">
            ${
              assignment.estimated_duration_min
                ? `${assignment.estimated_duration_min} min`
                : "N/A"
            }
          </span>
        </div>
      </div>`;
  }

  function renderStops(container, countEl, stops) {
    countEl.textContent = stops.length;

    if (stops.length === 0) {
      container.innerHTML = `
        <div class="no-route">
          <p>No stops found for this route.</p>
        </div>`;
      return;
    }

    container.innerHTML = stops
      .map(
        (stop, index) => `
      <div class="stop-card" id="stop-${stop.id}">
        <div class="stop-header" onclick="RouteView.toggleStop('${stop.id}')">
          <div class="stop-seq">${stop.sequence_number}</div>
          <div class="stop-info">
            <div class="stop-name">${stop.name}</div>
            <div class="stop-time">
              ${
                stop.scheduled_arrival_time
                  ? `⏰ ${stop.scheduled_arrival_time}`
                  : "No scheduled time"
              }
            </div>
          </div>
          <div class="stop-meta">
            <span class="student-count">
              👥 ${stop.students.length}
            </span>
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
        (student) => `
      <div class="student-item">
        <div class="student-avatar">
          ${student.full_name.charAt(0).toUpperCase()}
        </div>
        <div class="student-info">
          <div class="student-name">${student.full_name}</div>
          <div class="student-roll">
            ${student.roll ? `Roll: ${student.roll}` : "No roll number"}
          </div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function toggleStop(stopId) {
    const card = document.getElementById(`stop-${stopId}`);
    if (card) card.classList.toggle("expanded");
  }

  return { init, toggleStop };
})();
