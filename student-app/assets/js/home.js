/**
 * Home Screen Controller
 */
const Home = (() => {
  function render(profile) {
    renderStatusCard(profile);
    renderTripBanner(profile);
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
            <span class="status-info-value">⏰ ${profile.scheduled_arrival_time || "N/A"}</span>
          </div>
        </div>`;
    } else if (status === "pending") {
      card.innerHTML = `
        <div class="status-card-header">
          <span class="status-card-title">Bus Request</span>
          <span class="status-pill pending">Pending</span>
        </div>
        <p style="color:var(--text-muted);font-size:14px;margin-top:8px">
          Your bus request is being reviewed by admin. You will be notified once approved.
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
          You don't have a bus assigned yet. Request bus service to get started.
        </p>
        <button class="btn btn-primary" onclick="App.switchTab('bus')" style="margin-top:4px">
          Request Bus Service
        </button>`;
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
