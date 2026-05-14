/**
 * Dashboard Page Controller
 * Loads stats, map, recent activity, today's trips
 */
(async function () {
  // Set current date
  const dateEl = document.getElementById("currentDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Load all dashboard data
  await Promise.all([
    loadStats(),
    loadRecentRequests(),
    loadRecentComplaints(),
    loadTodayTrips(),
    initDashboardMap(),
  ]);

  //load dashboard stats

  async function loadStats() {
    try {
      const data = await apiFetch("/stats");
      const s = data.stats || data;

      setText("totalBuses", s.total_buses ?? "-");
      setText("activeBuses", `${s.active_buses ?? "-"} active`);
      setText("totalDrivers", s.total_drivers ?? "-");
      setText("activeDrivers", `${s.active_drivers ?? "-"} active`);
      setText("pendingRequests", s.pending_requests ?? "-");
      setText("openComplaints", s.open_complaints ?? "-");

      // Update sidebar badges
      const reqBadge = document.getElementById("navRequestsBadge");
      const compBadge = document.getElementById("navComplaintsBadge");

      if (reqBadge && s.pending_requests > 0) {
        reqBadge.textContent = s.pending_requests;
      }
      if (compBadge && s.open_complaints > 0) {
        compBadge.textContent = s.open_complaints;
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }

  // ── Recent Requests ─────────────────────────────────────────────────────
  async function loadRecentRequests() {
    const container = document.getElementById("recentRequests");
    if (!container) return;

    try {
      const data = await apiFetch("/bus-requests?limit=5");
      const requests = data.requests || data || [];

      if (requests.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No recent requests</p>
          </div>`;
        return;
      }

      container.innerHTML = requests
        .slice(0, 5)
        .map(
          (req) => `
        <div class="activity-item">
          <div class="activity-icon request">📋</div>
          <div class="activity-info">
            <div class="activity-title">${req.full_name || req.student_name || "Student"}</div>
            <div class="activity-meta">
              ${req.created_at ? new Date(req.created_at).toLocaleDateString() : ""} 
              • ${req.bus_request_status || req.status || "pending"}
            </div>
          </div>
          <span class="badge badge-${req.bus_request_status || req.status || "pending"}">
            ${req.bus_request_status || req.status || "pending"}
          </span>
        </div>`,
        )
        .join("");
    } catch (err) {
      console.error("Failed to load requests:", err);
      container.innerHTML = `<div class="empty-state"><p>Failed to load</p></div>`;
    }
  }

  // ── Recent Complaints ───────────────────────────────────────────────────
  async function loadRecentComplaints() {
    const container = document.getElementById("recentComplaints");
    if (!container) return;

    try {
      const data = await apiFetch("/complaints?limit=5");
      const complaints = data.complaints || data || [];

      if (complaints.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No recent complaints</p>
          </div>`;
        return;
      }

      container.innerHTML = complaints
        .slice(0, 5)
        .map(
          (c) => `
        <div class="activity-item">
          <div class="activity-icon complaint">⚠️</div>
          <div class="activity-info">
            <div class="activity-title">${c.category || "General"}</div>
            <div class="activity-meta">
              ${c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}
              • Priority: ${c.priority || "medium"}
            </div>
          </div>
          <span class="badge badge-${c.status || "open"}">
            ${c.status || "open"}
          </span>
        </div>`,
        )
        .join("");
    } catch (err) {
      console.error("Failed to load complaints:", err);
      container.innerHTML = `<div class="empty-state"><p>Failed to load</p></div>`;
    }
  }

  // ── Today's Trips ───────────────────────────────────────────────────────
  async function loadTodayTrips() {
    const tbody = document.getElementById("todayTrips");
    if (!tbody) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await apiFetch(`/trips?date=${today}`);
      const trips = data.trips || data || [];

      if (trips.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="loading">No trips today</td>
          </tr>`;
        return;
      }

      tbody.innerHTML = trips
        .map(
          (trip) => `
        <tr>
          <td>${trip.route_name || "-"}</td>
          <td>${trip.driver_name || "-"}</td>
          <td>${trip.bus_number || "-"}</td>
          <td>
            <span class="badge badge-${trip.trip_type === "pickup" ? "active" : "low"}">
              ${trip.trip_type || "-"}
            </span>
          </td>
          <td>
            <span class="badge badge-${trip.status || "scheduled"}">
              ${trip.status || "scheduled"}
            </span>
          </td>
          <td>${trip.start_time ? new Date(trip.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
        </tr>`,
        )
        .join("");
    } catch (err) {
      console.error("Failed to load trips:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="loading">Failed to load trips</td>
        </tr>`;
    }
  }

  // ── Dashboard Map ───────────────────────────────────────────────────────
  async function initDashboardMap() {
    const mapEl = document.getElementById("dashboardMap");
    if (!mapEl) return;

    const map = L.map("dashboardMap", {
      zoomControl: true,
      attributionControl: false,
    }).setView([17.05, 82.15], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    try {
      const data = await apiFetch("/live-locations/all-latest");
      const locations = data.locations || [];

      if (locations.length === 0) {
        // No buses online - show message on map
        L.popup()
          .setLatLng([17.05, 82.15])
          .setContent(
            "<p style='text-align:center;margin:0'>No buses currently active</p>",
          )
          .openOn(map);
        return;
      }

      const bounds = [];

      locations.forEach((loc) => {
        if (!loc.latitude || !loc.longitude) return;

        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: L.divIcon({
            className: "bus-marker-dash",
            html: `<div class="bus-dot"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        })
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;font-size:13px;line-height:1.5">
            <strong>🚌 ${loc.bus_number || "-"}</strong><br/>
            Driver: ${loc.driver_name || "-"}<br/>
            Route: ${loc.route_name || "-"}<br/>
            Speed: ${loc.speed_kmh || 0} km/h<br/>
            <small>${new Date(loc.recorded_at).toLocaleTimeString()}</small>
          </div>`,
          )
          .addTo(map);

        bounds.push([loc.latitude, loc.longitude]);
      });

      // Fit map to show all buses
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      }
    } catch (err) {
      console.warn("No live locations available:", err.message);
    }

    setTimeout(() => map.invalidateSize(), 200);
  }

  // ── Helper ──────────────────────────────────────────────────────────────
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
})();
