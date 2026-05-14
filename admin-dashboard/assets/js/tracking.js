/**
 * Live Tracking Page Controller
 * Real-time bus positions on map with bus list panel
 */
(function () {
  let map = null;
  let busMarkers = {};
  let trailPolyline = null;
  let selectedBusId = null;
  let refreshInterval = null;
  let allLocations = [];

  const REFRESH_MS = 10000; // 10 seconds

  // ── Init ──────────────────────────────────────────────────────────────
  init();

  async function init() {
    initMap();
    await loadBusLocations();
    setupControls();
    startAutoRefresh();
  }

  // ── Map Setup ─────────────────────────────────────────────────────────
  function initMap() {
    map = L.map("trackingMap", {
      zoomControl: true,
      attributionControl: false,
    }).setView([17.05, 82.15], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
  }

  // ── Load Bus Locations ────────────────────────────────────────────────
  async function loadBusLocations() {
    try {
      const data = await apiFetch("/live-locations/all-latest");
      allLocations = data.locations || [];
      renderBusList(allLocations);
      updateMapMarkers(allLocations);
      document.getElementById("activeBusCount").textContent =
        allLocations.length;
    } catch (err) {
      console.warn("Failed to load locations:", err.message);
      renderBusList([]);
      document.getElementById("activeBusCount").textContent = "0";
    }
  }

  // ── Render Bus List ───────────────────────────────────────────────────
  function renderBusList(locations) {
    const container = document.getElementById("busList");

    if (locations.length === 0) {
      container.innerHTML = `
        <div class="no-buses-state">
          <div class="empty-icon">🚌</div>
          <h4>No Active Buses</h4>
          <p>No buses are currently transmitting location data.</p>
        </div>`;
      return;
    }

    container.innerHTML = locations
      .map(
        (loc) => `
      <div class="bus-item ${selectedBusId === loc.bus_id ? "active" : ""}" 
           data-bus-id="${loc.bus_id}"
           onclick="selectBus('${loc.bus_id}')">
        <div class="bus-item-dot online"></div>
        <div class="bus-item-info">
          <div class="bus-item-name">${loc.bus_number || "Unknown"}</div>
          <div class="bus-item-meta">
            ${loc.driver_name || "No driver"} • ${loc.route_name || "No route"}
          </div>
        </div>
        <div class="bus-item-speed">${Math.round(loc.speed_kmh || 0)} km/h</div>
      </div>`,
      )
      .join("");
  }

  // ── Update Map Markers ────────────────────────────────────────────────
  function updateMapMarkers(locations) {
    // Remove markers that are no longer in the list
    Object.keys(busMarkers).forEach((busId) => {
      const stillExists = locations.find((l) => l.bus_id === busId);
      if (!stillExists) {
        map.removeLayer(busMarkers[busId]);
        delete busMarkers[busId];
      }
    });

    const bounds = [];

    locations.forEach((loc) => {
      if (!loc.latitude || !loc.longitude) return;

      const isSelected = selectedBusId === loc.bus_id;
      const latlng = [loc.latitude, loc.longitude];
      bounds.push(latlng);

      if (busMarkers[loc.bus_id]) {
        // Update existing marker position
        busMarkers[loc.bus_id].setLatLng(latlng);

        // Update icon if selection changed
        busMarkers[loc.bus_id].setIcon(createBusIcon(isSelected));
      } else {
        // Create new marker
        const marker = L.marker(latlng, {
          icon: createBusIcon(isSelected),
          zIndexOffset: isSelected ? 1000 : 0,
        })
          .bindPopup(createPopupContent(loc))
          .addTo(map);

        marker.on("click", () => selectBus(loc.bus_id));
        busMarkers[loc.bus_id] = marker;
      }
    });

    // Fit bounds on first load
    if (bounds.length > 0 && !selectedBusId) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  // ── Create Bus Icon ───────────────────────────────────────────────────
  function createBusIcon(isSelected) {
    return L.divIcon({
      className: "bus-marker-tracking",
      html: `<div class="bus-marker-dot ${isSelected ? "selected" : ""}"></div>`,
      iconSize: isSelected ? [22, 22] : [18, 18],
      iconAnchor: isSelected ? [11, 11] : [9, 9],
    });
  }

  // ── Create Popup Content ──────────────────────────────────────────────
  function createPopupContent(loc) {
    return `
      <div style="font-family:Inter,sans-serif;font-size:13px;line-height:1.6;min-width:160px">
        <strong>🚌 ${loc.bus_number || "-"}</strong><br/>
        Driver: ${loc.driver_name || "-"}<br/>
        Route: ${loc.route_name || "-"}<br/>
        Speed: ${Math.round(loc.speed_kmh || 0)} km/h<br/>
        <small style="color:#94a3b8">${new Date(loc.recorded_at).toLocaleTimeString()}</small>
      </div>`;
  }

  // ── Select Bus ────────────────────────────────────────────────────────
  window.selectBus = function (busId) {
    selectedBusId = busId;

    const loc = allLocations.find((l) => l.bus_id === busId);
    if (!loc) return;

    // Update bus list active state
    document.querySelectorAll(".bus-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.busId === busId);
    });

    // Update marker icons
    Object.keys(busMarkers).forEach((id) => {
      busMarkers[id].setIcon(createBusIcon(id === busId));
      busMarkers[id].setZIndexOffset(id === busId ? 1000 : 0);
    });

    // Center map on selected bus
    map.setView([loc.latitude, loc.longitude], 15, { animate: true });

    // Show info overlay
    showBusOverlay(loc);

    // Remove existing trail
    if (trailPolyline) {
      map.removeLayer(trailPolyline);
      trailPolyline = null;
    }
  };

  // ── Show Bus Overlay ──────────────────────────────────────────────────
  function showBusOverlay(loc) {
    const overlay = document.getElementById("busInfoOverlay");
    overlay.classList.remove("hidden");

    document.getElementById("overlayBusName").textContent =
      loc.bus_number || "-";
    document.getElementById("overlayRoute").textContent =
      loc.route_name || "No route assigned";
    document.getElementById("overlayDriver").textContent =
      loc.driver_name || "-";
    document.getElementById("overlaySpeed").textContent =
      `${Math.round(loc.speed_kmh || 0)} km/h`;
    document.getElementById("overlayTime").textContent = loc.recorded_at
      ? new Date(loc.recorded_at).toLocaleTimeString()
      : "-";
    document.getElementById("overlayStatus").textContent = "Active";
  }

  // ── Controls ──────────────────────────────────────────────────────────
  function setupControls() {
    // Close overlay
    document.getElementById("closeOverlay").addEventListener("click", () => {
      document.getElementById("busInfoOverlay").classList.add("hidden");
      selectedBusId = null;

      // Reset markers
      Object.keys(busMarkers).forEach((id) => {
        busMarkers[id].setIcon(createBusIcon(false));
      });

      document.querySelectorAll(".bus-item").forEach((item) => {
        item.classList.remove("active");
      });
    });

    // Refresh button
    document.getElementById("refreshBtn").addEventListener("click", () => {
      loadBusLocations();
    });

    // Auto-refresh toggle
    document.getElementById("autoRefresh").addEventListener("change", (e) => {
      if (e.target.checked) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });

    // View trail button
    document
      .getElementById("viewTrailBtn")
      .addEventListener("click", async () => {
        if (!selectedBusId) return;
        await loadTrail();
      });

    // Bus search
    document.getElementById("busSearch").addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = allLocations.filter(
        (loc) =>
          (loc.bus_number || "").toLowerCase().includes(query) ||
          (loc.driver_name || "").toLowerCase().includes(query) ||
          (loc.route_name || "").toLowerCase().includes(query),
      );
      renderBusList(filtered);
    });
  }

  // ── Load Trail ────────────────────────────────────────────────────────
  async function loadTrail() {
    const loc = allLocations.find((l) => l.bus_id === selectedBusId);
    if (!loc || !loc.trip_id) {
      alert("No active trip for this bus");
      return;
    }

    try {
      const data = await apiFetch(`/live-locations/trail/${loc.trip_id}`);
      const trail = data.trail || [];

      if (trail.length === 0) {
        alert("No trail data available");
        return;
      }

      // Remove old trail
      if (trailPolyline) {
        map.removeLayer(trailPolyline);
      }

      const coords = trail.map((t) => [t.latitude, t.longitude]);

      trailPolyline = L.polyline(coords, {
        color: "#6366f1",
        weight: 4,
        opacity: 0.8,
        dashArray: null,
        lineCap: "round",
      }).addTo(map);

      map.fitBounds(trailPolyline.getBounds(), { padding: [40, 40] });
    } catch (err) {
      console.error("Failed to load trail:", err);
      alert("Failed to load trail data");
    }
  }

  // ── Auto Refresh ──────────────────────────────────────────────────────
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(loadBusLocations, REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
})();
