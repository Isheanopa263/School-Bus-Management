/**
 * Reports & Analytics Page Controller
 */
(function () {
  const API_BASE =
    "https://school-bus-management-production.up.railway.app/api";
  let currentTab = "trips";
  let charts = {};

  init();

  async function init() {
    setDefaultDates();
    await loadRouteFilter();
    setupEvents();
    loadReport();
  }

  // ── Setup ─────────────────────────────────────────────────────────────
  function setDefaultDates() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    el("toDate").value = to.toISOString().split("T")[0];
    el("fromDate").value = from.toISOString().split("T")[0];
  }

  async function loadRouteFilter() {
    try {
      const data = await apiFetch("/routes");
      const routes = data.routes || [];
      const select = el("routeFilter");
      routes.forEach((r) => {
        select.innerHTML += `<option value="${r.rid}">${r.name}</option>`;
      });
    } catch (err) {
      console.warn("Could not load routes for filter:", err.message);
    }
  }

  function setupEvents() {
    // Tab switching
    document.querySelectorAll(".report-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    el("applyBtn").addEventListener("click", loadReport);
    el("exportCsvBtn").addEventListener("click", () => exportReport("csv"));
    el("exportPdfBtn").addEventListener("click", () => exportReport("pdf"));
  }

  function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll(".report-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });

    // Show correct section
    document.querySelectorAll(".report-section").forEach((s) => {
      s.classList.toggle("active", s.id === `section-${tab}`);
    });

    // Show period filter only for driver-hours
    el("periodGroup").style.display = tab === "driver-hours" ? "block" : "none";

    loadReport();
  }

  // ── Load Report ───────────────────────────────────────────────────────
  async function loadReport() {
    const from = el("fromDate").value;
    const to = el("toDate").value;
    const routeId = el("routeFilter").value;
    const period = el("periodFilter").value;

    const params = new URLSearchParams({ from, to });
    if (routeId) params.append("route_id", routeId);
    if (currentTab === "driver-hours") params.append("period", period);

    try {
      const data = await apiFetch(`/reports/${currentTab}?${params}`);
      const rows = data.report || data;
      render(currentTab, Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Report load error:", err);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────
  function exportReport(format) {
    const from = el("fromDate").value;
    const to = el("toDate").value;
    const routeId = el("routeFilter").value;
    const period = el("periodFilter").value;
    const params = new URLSearchParams({ from, to, format });
    if (routeId) params.append("route_id", routeId);
    if (currentTab === "driver-hours") params.append("period", period);

    const token = sessionStorage.getItem("admin_token");
    window.open(
      `${API_BASE}/api/reports/${currentTab}?${params}&token=${token}`,
      "_blank",
    );
  }

  // ── Render Dispatcher ─────────────────────────────────────────────────
  function render(tab, data) {
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
    renderers[tab]?.(data);
  }

  // ── Chart Helpers ─────────────────────────────────────────────────────
  const COLORS = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#0ea5e9",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
  ];

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function makeBarChart(canvasId, key, labels, datasets) {
    destroyChart(key);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[key] = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        },
      },
    });
  }

  function makeDoughnutChart(canvasId, key, labels, dataArr) {
    destroyChart(key);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[key] = new Chart(ctx, {
      type: "doughnut",
      data: { labels, datasets: [{ data: dataArr, backgroundColor: COLORS }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
      },
    });
  }

  function showEmpty(bodyId, cols, message = "No data for selected period") {
    el(bodyId).innerHTML =
      `<tr><td colspan="${cols}" class="loading">${message}</td></tr>`;
  }

  // ── Renderers ─────────────────────────────────────────────────────────

  function renderTrips(data) {
    // Stats
    const total = data.length;
    const completed = data.filter((t) => t.status === "completed").length;
    const ongoing = data.filter((t) => t.status === "ongoing").length;
    const avgDelay = data.length
      ? (
          data.reduce((s, t) => s + (parseFloat(t.delay_minutes) || 0), 0) /
          total
        ).toFixed(1)
      : 0;

    el("tripsStats").innerHTML = `
      <div class="report-stat"><div class="report-stat-value">${total}</div><div class="report-stat-label">Total Trips</div></div>
      <div class="report-stat success"><div class="report-stat-value">${completed}</div><div class="report-stat-label">Completed</div></div>
      <div class="report-stat warning"><div class="report-stat-value">${ongoing}</div><div class="report-stat-label">Ongoing</div></div>
      <div class="report-stat error"><div class="report-stat-value">${avgDelay}</div><div class="report-stat-label">Avg Delay (min)</div></div>`;

    // Chart
    const statusMap = {};
    data.forEach((t) => (statusMap[t.status] = (statusMap[t.status] || 0) + 1));
    makeBarChart("tripsChart", "trips", Object.keys(statusMap), [
      {
        label: "Trips",
        data: Object.values(statusMap),
        backgroundColor: "#6366f1",
      },
    ]);

    // Table
    el("tripsCount").textContent = `${total} records`;
    if (!data.length) return showEmpty("tripsBody", 7);
    el("tripsBody").innerHTML = data
      .map(
        (t) => `
      <tr>
        <td>${t.trip_date ? new Date(t.trip_date).toLocaleDateString() : "-"}</td>
        <td>${t.route_name || "-"}</td>
        <td>${t.bus_number || "-"}</td>
        <td>${t.driver_name || "-"}</td>
        <td><span class="badge badge-${t.trip_type === "pickup" ? "active" : "low"}">${t.trip_type || "-"}</span></td>
        <td><span class="badge badge-${t.status}">${t.status}</span></td>
        <td>${t.delay_minutes || 0} min</td>
      </tr>`,
      )
      .join("");
  }

  function renderDelays(data) {
    makeBarChart(
      "delaysChart",
      "delays",
      data.map((d) => d.route_name),
      [
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
    );

    el("delaysCount").textContent = `${data.length} routes`;
    if (!data.length) return showEmpty("delaysBody", 5);
    el("delaysBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${d.route_name}</td>
        <td>${d.total_trips}</td>
        <td>${parseFloat(d.avg_delay || 0).toFixed(1)} min</td>
        <td>${d.max_delay || 0} min</td>
        <td><span class="badge ${parseInt(d.delayed_trips) > 5 ? "badge-open" : "badge-active"}">${d.delayed_trips}</span></td>
      </tr>`,
      )
      .join("");
  }

  function renderDriverHours(data) {
    const uniqueDrivers = [...new Set(data.map((d) => d.driver_name))];
    makeBarChart("driverHoursChart", "driverHours", uniqueDrivers, [
      {
        label: "Total Hours",
        data: uniqueDrivers.map((name) => {
          return data
            .filter((d) => d.driver_name === name)
            .reduce((s, d) => s + parseFloat(d.total_hours || 0), 0)
            .toFixed(1);
        }),
        backgroundColor: "#10b981",
      },
    ]);

    el("driverHoursCount").textContent = `${data.length} records`;
    if (!data.length) return showEmpty("driverHoursBody", 4);
    el("driverHoursBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${d.driver_name}</td>
        <td>${d.period_start ? new Date(d.period_start).toLocaleDateString() : "-"}</td>
        <td>${d.trips_count}</td>
        <td>${parseFloat(d.total_hours || 0).toFixed(1)} hrs</td>
      </tr>`,
      )
      .join("");
  }

  function renderBusUtil(data) {
    makeDoughnutChart(
      "busUtilChart",
      "busUtil",
      data.map((d) => d.registration_number),
      data.map((d) => parseFloat(d.utilization_percent || 0)),
    );

    el("busUtilCount").textContent = `${data.length} buses`;
    if (!data.length) return showEmpty("busUtilBody", 5);
    el("busUtilBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${d.registration_number}</td>
        <td>${d.capacity}</td>
        <td>${d.trips_assigned}</td>
        <td>${parseFloat(d.scheduled_hours || 0).toFixed(1)} hrs</td>
        <td>
          <span class="badge ${parseFloat(d.utilization_percent) > 70 ? "badge-active" : parseFloat(d.utilization_percent) > 40 ? "badge-maintenance" : "badge-inactive"}">
            ${d.utilization_percent || 0}%
          </span>
        </td>
      </tr>`,
      )
      .join("");
  }

  function renderOnTime(data) {
    makeBarChart(
      "onTimeChart",
      "onTime",
      data.map((d) => d.route_name),
      [
        {
          label: "On-Time %",
          data: data.map((d) => parseFloat(d.on_time_percent || 0)),
          backgroundColor: "#10b981",
        },
      ],
    );

    el("onTimeCount").textContent = `${data.length} records`;
    if (!data.length) return showEmpty("onTimeBody", 7);
    el("onTimeBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${d.route_name}</td>
        <td>${d.driver_name}</td>
        <td>${d.total_trips}</td>
        <td>${d.on_time_trips}</td>
        <td>${d.minor_delay}</td>
        <td>${d.major_delay}</td>
        <td>
          <span class="badge ${parseFloat(d.on_time_percent) >= 90 ? "badge-active" : parseFloat(d.on_time_percent) >= 70 ? "badge-maintenance" : "badge-open"}">
            ${d.on_time_percent || 0}%
          </span>
        </td>
      </tr>`,
      )
      .join("");
  }

  function renderRouteEff(data) {
    makeBarChart(
      "routeEffChart",
      "routeEff",
      data.map((d) => d.route_name),
      [
        {
          label: "Total Trips",
          data: data.map((d) => d.total_trips || 0),
          backgroundColor: "#6366f1",
        },
      ],
    );

    el("routeEffCount").textContent = `${data.length} routes`;
    if (!data.length) return showEmpty("routeEffBody", 4);
    el("routeEffBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${d.route_name}</td>
        <td>${d.distance_km || "-"} km</td>
        <td>${d.total_trips || 0}</td>
        <td>${parseFloat(d.avg_trip_mins || 0).toFixed(0)} min</td>
      </tr>`,
      )
      .join("");
  }

  function renderStudentLoad(data) {
    makeBarChart(
      "studentLoadChart",
      "studentLoad",
      data.map((d) => `${d.stop_name || "?"}`),
      [
        {
          label: "Students",
          data: data.map((d) => d.students_assigned || 0),
          backgroundColor: "#8b5cf6",
        },
      ],
    );

    el("studentLoadCount").textContent = `${data.length} stops`;
    if (!data.length) return showEmpty("studentLoadBody", 4);
    el("studentLoadBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${d.route_name || "-"}</td>
        <td>${d.stop_name || "-"}</td>
        <td>${d.stop_order || "-"}</td>
        <td>${d.students_assigned || 0}</td>
      </tr>`,
      )
      .join("");
  }

  function renderComplaints(data) {
    const catMap = {};
    data.forEach((c) => {
      catMap[c.category] =
        (catMap[c.category] || 0) + parseInt(c.total_count || 0);
    });

    makeDoughnutChart(
      "complaintsChart",
      "complaints",
      Object.keys(catMap),
      Object.values(catMap),
    );

    el("complaintsCount").textContent = `${data.length} records`;
    if (!data.length) return showEmpty("complaintsBody", 7);
    el("complaintsBody").innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${(d.category || "other").replace("_", " ")}</td>
        <td><span class="badge badge-${d.priority}">${d.priority || "-"}</span></td>
        <td>${(d.status || "-").replace("_", " ")}</td>
        <td>${d.total_count || 0}</td>
        <td>${d.resolved_count || 0}</td>
        <td>${d.avg_resolution_hours ? parseFloat(d.avg_resolution_hours).toFixed(1) + "h" : "N/A"}</td>
        <td>
          <span class="badge ${parseInt(d.overdue_count) > 0 ? "badge-open" : "badge-active"}">
            ${d.overdue_count || 0}
          </span>
        </td>
      </tr>`,
      )
      .join("");
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function el(id) {
    return document.getElementById(id);
  }
})();
