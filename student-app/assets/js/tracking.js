/**
 * Live Tracking Screen Controller
 */
const Tracking = (() => {
  let trackingMap = null;
  let busMarker = null;
  let stopMarker = null;
  let refreshTimer = null;

  function init() {
    const refreshBtn = document.getElementById("refreshTrackingBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", load);
  }

  async function load() {
    const container = document.getElementById("trackingContent");
    if (!container) return;

    const profile = App.getProfile();

    if (
      !profile ||
      profile.bus_request_status !== "approved" ||
      !profile.bus_id
    ) {
      container.innerHTML = `
        <div class="no-tracking">
          <div class="no-tracking-icon">📍</div>
          <h3>No Bus Assigned</h3>
          <p>Request bus service first to track your bus location.</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="App.switchTab('bus')">
            Request Bus
          </button>
        </div>`;
      return;
    }

    try {
      const data = await StudentAPI.getLiveLocation(profile.bus_id);
      const loc = data.location;

      if (!loc || !loc.latitude) {
        renderNoSignal(container, profile);
        return;
      }

      renderMap(container, loc, profile);
    } catch (err) {
      renderNoSignal(container, profile);
    }
  }

  function renderNoSignal(container, profile) {
    container.innerHTML = `
      <div class="tracking-info-bar">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">🚌 Bus ${profile.bus_number || ""}</div>
          <div style="font-size:12px;color:var(--text-muted)">Route: ${profile.route_name || "N/A"}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;color:var(--warning);font-weight:600">⚠️ No Signal</div>
        </div>
      </div>
      <div class="no-tracking">
        <div class="no-tracking-icon">📡</div>
        <h3>Bus Not Broadcasting</h3>
        <p>The bus is not currently sending location data. This may mean no active trip right now.</p>
      </div>`;
  }

  function renderMap(container, loc, profile) {
    container.innerHTML = `
      <div class="tracking-info-bar">
        <div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:600">ETA TO YOUR STOP</div>
            <div class="tracking-eta" id="etaValue">Calculating...</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="tracking-status-dot"></div>
          <span style="font-size:13px;font-weight:600;color:var(--success)">Live</span>
        </div>
      </div>

      <div id="trackingMap" class="tracking-map"></div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;color:var(--text-muted)">My Stop</div>
            <div style="font-size:14px;font-weight:600">📍 ${profile.stop_name || "N/A"}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted)">Speed</div>
            <div style="font-size:14px;font-weight:600" id="busSpeed">${Math.round(loc.speed_kmh || 0)} km/h</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted)">Updated</div>
            <div style="font-size:13px;font-weight:600">${new Date(loc.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
      </div>`;

    // Init map
    setTimeout(() => {
      if (trackingMap) trackingMap.remove();

      trackingMap = L.map("trackingMap").setView(
        [loc.latitude, loc.longitude],
        14,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        trackingMap,
      );

      // Bus marker
      busMarker = L.marker([loc.latitude, loc.longitude], {
        icon: L.divIcon({
          className: "bus-map-marker",
          html: `<div style="background:#10b981;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚌</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      })
        .addTo(trackingMap)
        .bindPopup(
          `<strong>Your Bus</strong><br/>Speed: ${Math.round(loc.speed_kmh || 0)} km/h`,
        );

      // Student's stop marker
      if (profile.stop_id) {
        // Fetch stop coords from profile
        // For now show a marker at student's stop if coords available
      }
    }, 200);
  }

  return { init, load };
})();
