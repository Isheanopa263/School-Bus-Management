const Home = (() => {
  function render(profile) {
    renderStatusCard(profile);
    renderTripBanner(profile);

    // If approved, fetch live ETA for arrival time
    if (profile.bus_request_status === "approved" && profile.bus_id) {
      loadDynamicArrival(profile);
    }
  }

  function renderStatusCard(profile) {
    const card = document.getElementById("homeStatusCard");
    if (!card) return;

    const status = profile.bus_request_status;

    if (status === "approved" && profile.stop_name) {
      card.innerHTML = `
        <div class="status-card-header">
          <span class="status-card-title">My Bus Assignment</span>
          <span class="status-pill approved">Approved</span>
        </div>
        <div class="status-info-grid">
          <div class="status-info-item">
            <span class="status-info-label">Bus</span>
            <span class="status-info-value">🚌 ${profile.bus_number || "N/A"}</span>
          </div>
          <div class="status-info-item">
            <span class="status-info-label">My Stop</span>
            <span class="status-info-value">📍 ${profile.stop_name}</span>
          </div>
          <div class="status-info-item">
            <span class="status-info-label">Route</span>
            <span class="status-info-value">${profile.route_name || "N/A"}</span>
          </div>
          <div class="status-info-item">
            <span class="status-info-label">Arrival</span>
            <span class="status-info-value" id="homeArrivalTime">
              <span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span>
            </span>
          </div>
        </div>`;
    } else if (status === "pending") {
      card.innerHTML = `
        <div class="status-card-header">
          <span class="status-card-title">Bus Request</span>
          <span class="status-pill pending">Pending</span>
        </div>
        <p style="color:var(--text-muted);font-size:14px;margin-top:8px">
          Your bus request is being reviewed by admin.
        </p>`;
    } else if (status === "rejected") {
      card.innerHTML = `
        <div class="status-card-header">
          <span class="status-card-title">Bus Request</span>
          <span class="status-pill rejected">Rejected</span>
        </div>
        <p style="color:var(--text-muted);font-size:14px;margin-top:8px">
          Your request was not approved. Go to Bus Service to apply again.
        </p>`;
    } else {
      card.innerHTML = `
        <div class="status-card-header">
          <span class="status-card-title">Bus Service</span>
          <span class="status-pill none">Not Assigned</span>
        </div>
        <p style="color:var(--text-muted);font-size:14px;margin-top:8px;margin-bottom:16px">
          You don't have a bus assigned yet.
        </p>
        <button class="btn btn-primary" onclick="App.switchTab('bus')">
          Request Bus Service
        </button>`;
    }
  }

  async function loadDynamicArrival(profile) {
    const arrivalEl = document.getElementById("homeArrivalTime");
    if (!arrivalEl) return;

    try {
      const data = await StudentAPI.getLiveTracking();

      if (!data.bus || !data.eta) {
        // No live data - show scheduled time or "Not available"
        arrivalEl.textContent = profile.scheduled_arrival_time
          ? `⏰ ${profile.scheduled_arrival_time} (scheduled)`
          : "Not available";
        return;
      }

      if (data.stop?.already_visited) {
        arrivalEl.innerHTML = `<span style="color:var(--success)">✅ Already visited</span>`;
        return;
      }

      // Calculate actual arrival time
      const arrivalTime = new Date(
        Date.now() + data.eta.duration_min * 60 * 1000,
      );
      const timeStr = arrivalTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const etaStr =
        data.eta.duration_min < 1
          ? "Arriving now!"
          : `${data.eta.duration_min} min`;

      arrivalEl.innerHTML = `
        <span style="color:var(--primary);font-weight:700">${timeStr}</span>
        <span style="font-size:11px;color:var(--text-muted);display:block">
          ${etaStr} • ${data.eta.method === "osrm" ? "via road" : "estimated"}
        </span>`;
    } catch (err) {
      // Fallback to scheduled time
      arrivalEl.textContent = profile.scheduled_arrival_time
        ? `⏰ ${profile.scheduled_arrival_time} (scheduled)`
        : "Not available";
    }
  }

  function renderTripBanner(profile) {
    const banner = document.getElementById("tripBanner");
    if (!banner) return;

    if (profile.bus_request_status !== "approved" || !profile.bus_id) {
      banner.classList.add("hidden");
      return;
    }

    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="trip-banner scheduled">
        <div class="trip-banner-icon">🚌</div>
        <div>
          <div class="trip-banner-title">Bus Service Active</div>
          <div class="trip-banner-sub">Driver: ${profile.driver_name || "Assigned"}</div>
        </div>
      </div>`;
  }

  return { render };
})();
