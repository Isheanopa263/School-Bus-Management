const API_BASE = "http://localhost:3000";

let currentTab = "trips";
let charts = {};
let routes = [];

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./index.html";
}

async function init() {
  console.log("Initializing reports dashboard...");
  if (!requireAuth()) return;
  await loadRoutes();
  setDefaultDates();
  setupEventListeners();
  loadReport();
}

function setDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  document.getElementById("toDate").value = to.toISOString().split("T")[0];
  document.getElementById("fromDate").value = from.toISOString().split("T")[0];
}

async function loadRoutes() {
  try {
    const res = await apiFetch("/api/routes");
    routes = res.routes || [];
    const select = document.getElementById("routeFilter");
    routes.forEach((r) => {
      select.innerHTML += `<option value="${r.rid}">${r.name}</option>`;
    });
  } catch (err) {
    showToast("Failed to load routes", "error");
  }
}

function setupEventListeners() {
  document.getElementById("logoutBtn").onclick = handleLogout;
  document.getElementById("applyBtn").onclick = loadReport;
  document.getElementById("exportCsvBtn").onclick = () => exportReport("csv");
  document.getElementById("exportPdfBtn").onclick = () => exportReport("pdf");

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = (e) => switchTab(e.target.dataset.tab);
  });
}

function switchTab(tab) {
  currentTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".report-content")
    .forEach((c) => c.classList.add("hidden"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document.getElementById(tab + "Report").classList.remove("hidden");
  document
    .getElementById("periodFilterGroup")
    .classList.toggle("hidden", tab !== "driver-hours");
  loadReport();
}

async function loadReport() {
  console.log(`Loading report`);
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const route_id = document.getElementById("routeFilter").value;
  const period = document.getElementById("periodFilter").value;

  const params = new URLSearchParams({ from, to, route_id });
  if (currentTab === "driver-hours") params.append("period", period);

  try {
    const res = await apiFetch(`/api/reports/${currentTab}?${params}`);
    renderReport(currentTab, res.report || res);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderReport(type, data) {
  const renderers = {
    trips: renderTrips,
    delays: renderDelays,
    "driver-hours": renderDriverHours,
    "bus-utilization": renderBusUtil,
    "on-time-performance": renderOnTime,
    "route-efficiency": renderRouteEff,
    "student-load": renderStudentLoad,
    "complaints-summary": renderComplaints,
  };
  renderers[type]?.(data);
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function renderTrips(data) {
  const total = data.length;
  const completed = data.filter((t) => t.status === "completed").length;
  const avgDelay =
    data.reduce((sum, t) => sum + (t.delay_minutes || 0), 0) / total || 0;

  document.getElementById("tripsStats").innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Trips</div></div>
    <div class="stat-card"><div class="stat-value">${completed}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card"><div class="stat-value">${avgDelay.toFixed(1)}</div><div class="stat-label">Avg Delay (min)</div></div>
  `;

  destroyChart("trips");
  const statusCounts = {};
  data.forEach(
    (t) => (statusCounts[t.status] = (statusCounts[t.status] || 0) + 1),
  );
  charts.trips = new Chart(document.getElementById("tripsChart"), {
    type: "bar",
    data: {
      labels: Object.keys(statusCounts),
      datasets: [
        {
          label: "Trips",
          data: Object.values(statusCounts),
          backgroundColor: "#6366f1",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("tripsTableHead").innerHTML =
    "<tr><th>Date</th><th>Route</th><th>Bus</th><th>Driver</th><th>Type</th><th>Status</th><th>Delay</th><th>Events</th></tr>";
  document.getElementById("tripsTableBody").innerHTML = data
    .map(
      (t) => `
    <tr><td>${t.trip_date}</td><td>${t.route_name}</td><td>${t.bus_number}</td><td>${t.driver_name}</td>
    <td>${t.trip_type}</td><td><span class="badge ${t.status}">${t.status}</span></td>
    <td>${t.delay_minutes || 0} min</td><td>${t.event_count}</td></tr>
  `,
    )
    .join("");
}

function renderDelays(data) {
  destroyChart("delays");
  charts.delays = new Chart(document.getElementById("delaysChart"), {
    type: "bar",
    data: {
      labels: data.map((d) => d.route_name),
      datasets: [
        {
          label: "Avg Delay (min)",
          data: data.map((d) => parseFloat(d.avg_delay || 0)),
          backgroundColor: "#ef4444",
        },
        {
          label: "Max Delay (min)",
          data: data.map((d) => parseFloat(d.max_delay || 0)),
          backgroundColor: "#f59e0b",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("delaysTableHead").innerHTML =
    "<tr><th>Route</th><th>Total Trips</th><th>Avg Delay</th><th>Max Delay</th><th>Delayed >10min</th></tr>";
  document.getElementById("delaysTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.route_name}</td><td>${d.total_trips}</td><td>${parseFloat(d.avg_delay || 0).toFixed(1)} min</td>
    <td>${d.max_delay || 0} min</td><td><span class="badge ${d.delayed_trips > 5 ? "inactive" : "active"}">${d.delayed_trips}</span></td></tr>
  `,
    )
    .join("");
}

function renderDriverHours(data) {
  destroyChart("driverHours");
  charts.driverHours = new Chart(document.getElementById("driverHoursChart"), {
    type: "bar",
    data: {
      labels: data.map((d) => d.driver_name),
      datasets: [
        {
          label: "Total Hours",
          data: data.map((d) => parseFloat(d.total_hours)),
          backgroundColor: "#10b981",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("driverHoursTableHead").innerHTML =
    "<tr><th>Driver</th><th>Period</th><th>Trips</th><th>Hours</th><th>Days</th><th>Routes</th></tr>";
  document.getElementById("driverHoursTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.driver_name}</td><td>${d.period_start.slice(0, 10)}</td><td>${d.trips_count}</td>
    <td>${parseFloat(d.total_hours).toFixed(1)}</td><td>${d.days_worked}</td><td>${d.routes_covered}</td></tr>
  `,
    )
    .join("");
}

function renderBusUtil(data) {
  destroyChart("busUtil");
  charts.busUtil = new Chart(document.getElementById("busUtilChart"), {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.registration_number),
      datasets: [
        {
          data: data.map((d) => parseFloat(d.utilization_percent)),
          backgroundColor: [
            "#6366f1",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#06b6d4",
          ],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("busUtilTableHead").innerHTML =
    "<tr><th>Bus</th><th>Capacity</th><th>Trips</th><th>Scheduled Hrs</th><th>Idle Hrs</th><th>Utilization</th></tr>";
  document.getElementById("busUtilTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.registration_number}</td><td>${d.capacity}</td><td>${d.trips_assigned}</td>
    <td>${parseFloat(d.scheduled_hours).toFixed(1)}h</td><td>${parseFloat(d.idle_hours).toFixed(1)}h</td>
    <td><span class="badge ${d.utilization_percent > 70 ? "active" : d.utilization_percent > 40 ? "maintenance" : "inactive"}">${d.utilization_percent}%</span></td></tr>
  `,
    )
    .join("");
}

function renderOnTime(data) {
  destroyChart("onTime");
  charts.onTime = new Chart(document.getElementById("onTimeChart"), {
    type: "bar",
    data: {
      labels: data.map((d) => `${d.route_name} - ${d.driver_name}`),
      datasets: [
        {
          label: "On-Time %",
          data: data.map((d) => parseFloat(d.on_time_percent)),
          backgroundColor: "#10b981",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { max: 100 } },
    },
  });

  document.getElementById("onTimeTableHead").innerHTML =
    "<tr><th>Route</th><th>Driver</th><th>Total</th><th>On-Time</th><th>Minor</th><th>Major</th><th>Early</th><th>On-Time %</th></tr>";
  document.getElementById("onTimeTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.route_name}</td><td>${d.driver_name}</td><td>${d.total_trips}</td><td>${d.on_time_trips}</td>
    <td>${d.minor_delay}</td><td>${d.major_delay}</td><td>${d.early_arrivals}</td>
    <td><span class="badge ${d.on_time_percent >= 90 ? "active" : d.on_time_percent >= 70 ? "maintenance" : "inactive"}">${d.on_time_percent}%</span></td></tr>
  `,
    )
    .join("");
}

function renderRouteEff(data) {
  destroyChart("routeEff");
  charts.routeEff = new Chart(document.getElementById("routeEffChart"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Routes",
          data: data.map((d) => ({
            x: d.distance_km,
            y: parseFloat(d.passengers_per_km || 0),
          })),
          backgroundColor: "#6366f1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Distance (km)" } },
        y: { title: { display: true, text: "Passengers/km" } },
      },
    },
  });

  document.getElementById("routeEffTableHead").innerHTML =
    "<tr><th>Route</th><th>Distance</th><th>Trips</th><th>Avg Duration</th><th>Avg Speed</th><th>Passengers</th><th>Pax/km</th><th>Adherence</th></tr>";
  document.getElementById("routeEffTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.route_name}</td><td>${d.distance_km} km</td><td>${d.total_trips}</td>
    <td>${parseFloat(d.avg_trip_mins || 0).toFixed(0)} min</td><td>${d.avg_speed_kmh || 0} km/h</td>
    <td>${d.unique_passengers}</td><td>${d.passengers_per_km || 0}</td><td>${d.schedule_adherence_percent || 0}%</td></tr>
  `,
    )
    .join("");
}

function renderStudentLoad(data) {
  destroyChart("studentLoad");
  charts.studentLoad = new Chart(document.getElementById("studentLoadChart"), {
    type: "bar",
    data: {
      labels: data.map((d) => `${d.route_name} - ${d.stop_name}`),
      datasets: [
        {
          label: "Active Riders",
          data: data.map((d) => d.active_riders),
          backgroundColor: "#8b5cf6",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("studentLoadTableHead").innerHTML =
    "<tr><th>Route</th><th>Stop</th><th>Order</th><th>Assigned</th><th>Active Riders</th><th>% of Route</th></tr>";
  document.getElementById("studentLoadTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.route_name}</td><td>${d.stop_name}</td><td>${d.stop_order}</td>
    <td>${d.students_assigned}</td><td>${d.active_riders}</td><td>${d.stop_percent_of_route}%</td></tr>
  `,
    )
    .join("");
}

function renderComplaints(data) {
  const categoryCounts = {};
  data.forEach(
    (t) =>
      (categoryCounts[t.category] =
        (categoryCounts[t.category] || 0) + parseInt(t.total_count)),
  );

  destroyChart("complaints");
  charts.complaints = new Chart(document.getElementById("complaintsChart"), {
    type: "pie",
    data: {
      labels: Object.keys(categoryCounts),
      datasets: [
        {
          data: Object.values(categoryCounts),
          backgroundColor: [
            "#ef4444",
            "#f59e0b",
            "#10b981",
            "#3b82f6",
            "#8b5cf6",
          ],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  document.getElementById("complaintsTableHead").innerHTML =
    "<tr><th>Category</th><th>Priority</th><th>Status</th><th>Total</th><th>Resolved</th><th>Avg Resolution</th><th>Overdue</th></tr>";
  document.getElementById("complaintsTableBody").innerHTML = data
    .map(
      (d) => `
    <tr><td>${d.category}</td><td><span class="badge ${d.priority}">${d.priority}</span></td>
    <td>${d.status}</td><td>${d.total_count}</td><td>${d.resolved_count}</td>
    <td>${d.avg_resolution_hours ? parseFloat(d.avg_resolution_hours).toFixed(1) + "h" : "N/A"}</td>
    <td><span class="badge ${d.overdue_count > 0 ? "inactive" : "active"}">${d.overdue_count}</span></td></tr>
  `,
    )
    .join("");
}

function exportReport(format) {
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const route_id = document.getElementById("routeFilter").value;
  const period = document.getElementById("periodFilter").value;
  const params = new URLSearchParams({ from, to, route_id, format });
  if (currentTab === "driver-hours") params.append("period", period);

  window.open(`${API_BASE}/api/reports/${currentTab}?${params}`, "_blank");
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === "error" ? "#ef4444" : "#10b981"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.addEventListener("DOMContentLoaded", init);
