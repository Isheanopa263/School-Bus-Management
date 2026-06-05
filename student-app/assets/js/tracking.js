/**
 * Live Tracking Screen Controller
 * Shows bus position + ETA with OSRM road path
 */
const Tracking = (() => {
  let trackingMap = null;
  let busMarker = null;
  let stopMarker = null;
  let routeLine = null;
  let refreshTimer = null;

  const REFRESH_INTERVAL = 10000;

  function init() {
    const refreshBtn = document.getElementById("refreshTrackingBtn");
    if (refreshBtn) refreshBtn.onclick = () => load();
  }

  async function load() {
    const container = document.getElementById("trackingContent");
    if (!container) return;

    const profile = App.getProfile();

    if (!profile || profile.bus_request_status !== "approved") {
      container.innerHTML = `
        <div class="no-tracking">
          <div class="no-tracking-icon">📍</div>
          <h3>No Bus Assigned</h3>
          <p>Request bus service first to track your bus location.</p>
          <button class="btn btn-primary" style="margin-top:16px;width:auto;padding:10px 24px"
            onclick="App.switchTab('bus')">Request Bus</button>
        </div>`;
      stopAutoRefresh();
      return;
    }

    try {
      const data = await StudentAPI.getLiveTracking();

      if (!data.bus) {
        renderNoSignal(container, data);
        stopAutoRefresh();
        return;
      }

      renderTracking(container, data);
      startAutoRefresh();
    } catch (err) {
      console.error("Tracking error:", err);
      if (err.status === 404) {
        container.innerHTML = `
          <div class="no-tracking">
            <div class="no-tracking-icon">📍</div>
            <h3>No Active Assignment</h3>
            <p>Your bus assignment is not currently active.</p>
          </div>`;
      } else {
        container.innerHTML = `
          <div class="no-tracking">
            <div class="no-tracking-icon">📡</div>
            <h3>Connection Error</h3>
            <p>${err.message || "Failed to load tracking data"}</p>
          </div>`;
      }
      stopAutoRefresh();
    }
  }

  function renderNoSignal(container, data) {
    container.innerHTML = `
      <div class="tracking-info-bar">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">
            📍 ${data.stop?.stop_name || "Your Stop"}
          </div>
          <div style="font-size:12px;color:var(--text-muted)">Waiting for bus</div>
        </div>
        <div style="font-size:12px;color:var(--warning);font-weight:600">⚠️ No Signal</div>
      </div>
      <div class="no-tracking">
        <div class="no-tracking-icon">📡</div>
        <h3>Bus Not Broadcasting</h3>
        <p>Your bus is not currently sending location data.<br/>
        This usually means no active trip right now.</p>
      </div>`;
  }

  function renderTracking(container, data) {
    const { bus, stop, eta, trip_status } = data;

    // Calculate dynamic arrival time based on ETA
    let arrivalTimeStr = "--:--";
    if (eta && eta.duration_min && !stop?.already_visited) {
      const arrivalTime = new Date(Date.now() + eta.duration_min * 60 * 1000);
      arrivalTimeStr = arrivalTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const etaText = eta
      ? stop?.already_visited
        ? "Arrived"
        : eta.duration_min < 1
          ? "Arriving now"
          : `${eta.duration_min} min`
      : "--";

    const distText = eta
      ? eta.distance_m >= 1000
        ? `${(eta.distance_m / 1000).toFixed(1)} km`
        : `${eta.distance_m} m`
      : "--";

    const stopVisited = stop?.already_visited;

    container.innerHTML = `
      <!-- ETA Bar -->
      <div class="tracking-info-bar">
        <div>
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px">
            ${stopVisited ? "STOP VISITED ✅" : "ETA TO YOUR STOP"}
          </div>
          <div class="tracking-eta">${stopVisited ? "Arrived" : etaText}</div>
          <div style="font-size:12px;color:var(--text-muted)">${stop?.stop_name || "Your Stop"}</div>
        </div>
        <div style="text-align:right">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-bottom:4px">
            <div class="tracking-status-dot"></div>
            <span style="font-size:13px;font-weight:600;color:var(--success)">Live</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted)">${distText} away</div>
        </div>
      </div>

      <!-- Map -->
      <div id="trackingMap" class="tracking-map"></div>

      <!-- Bus Info -->
      <div class="card" style="margin-top:0">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center">
          <div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:600">BUS</div>
            <div style="font-size:14px;font-weight:700">🚌 ${bus.bus_number}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:600">SPEED</div>
            <div style="font-size:14px;font-weight:700">${Math.round(bus.speed_kmh)} km/h</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:600">ARRIVES</div>
            <div style="font-size:14px;font-weight:700;color:var(--primary)">${stopVisited ? "Done" : arrivalTimeStr}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:600">UPDATED</div>
            <div style="font-size:13px;font-weight:600">
              ${new Date(bus.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      <!-- Stop Status -->
      ${
        stopVisited
          ? `
        <div style="background:var(--success-light);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:14px 16px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">✅</div>
          <div style="font-weight:700;color:var(--success)">Bus has visited your stop</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
            The bus has already been to ${stop.stop_name}
          </div>
        </div>`
          : ""
      }`;

    setTimeout(() => initMap(bus, stop, eta), 100);
  }

  function initMap(bus, stop, eta) {
    const mapEl = document.getElementById("trackingMap");
    if (!mapEl) return;

    if (trackingMap) {
      trackingMap.remove();
      trackingMap = null;
    }

    trackingMap = L.map("trackingMap").setView(
      [bus.latitude, bus.longitude],
      14,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      trackingMap,
    );

    // Bus marker
    busMarker = L.marker([bus.latitude, bus.longitude], {
      icon: L.divIcon({
        className: "",
        html: `<div style="
          background:#10b981;color:white;border-radius:50%;
          width:36px;height:36px;display:flex;align-items:center;
          justify-content:center;font-size:18px;
          border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)
        ">🚌</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    })
      .addTo(trackingMap)
      .bindPopup(
        `<strong>Your Bus</strong><br/>${Math.round(bus.speed_kmh)} km/h`,
      );

    // Stop marker
    if (stop?.latitude && stop?.longitude) {
      stopMarker = L.marker([stop.latitude, stop.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            background:#6366f1;color:white;border-radius:50%;
            width:32px;height:32px;display:flex;align-items:center;
            justify-content:center;font-size:16px;
            border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)
          ">📍</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
      })
        .addTo(trackingMap)
        .bindPopup(`<strong>Your Stop</strong><br/>${stop.stop_name}`);

      // Draw route line
      if (eta?.geometry) {
        // OSRM returned actual road geometry
        routeLine = L.geoJSON(eta.geometry, {
          style: {
            color: "#10b981",
            weight: 4,
            opacity: 0.8,
          },
        }).addTo(trackingMap);

        // Fit map to route bounds
        trackingMap.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
      } else {
        // Fallback: dashed straight line
        routeLine = L.polyline(
          [
            [bus.latitude, bus.longitude],
            [stop.latitude, stop.longitude],
          ],
          { color: "#10b981", weight: 3, dashArray: "8 6", opacity: 0.6 },
        ).addTo(trackingMap);

        // Fit to both markers
        const bounds = L.latLngBounds(
          [bus.latitude, bus.longitude],
          [stop.latitude, stop.longitude],
        );
        trackingMap.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(load, REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return { init, load, stopRefresh: stopAutoRefresh };
})();
