/**
 * Navigation Controller
 * Manages map display, route rendering, turn-by-turn navigation
 */
const Navigation = (() => {
  let map = null;
  let routePolyline = null;
  let driverMarker = null;
  let stopMarkers = [];
  let stopsData = [];
  let currentStopIdx = 0;
  let isNavigating = false;

  const ARRIVAL_THRESHOLD_M = 100; // meters to consider "arrived"
  const DEFAULT_ZOOM = 14;

  // Custom icons
  const icons = {
    driver: null,
    stopDefault: null,
    stopNext: null,
    stopVisited: null,
  };

  // ── Initialize Map ───────────────────────────────────────────────────
  function initMap(stops, routePath) {
    const mapEl = document.getElementById("route-map");
    if (!mapEl) return;

    if (map) {
      map.remove();
      map = null;
    }

    stopsData = stops || [];
    stopMarkers = [];
    currentStopIdx = 0;

    map = L.map("route-map", {
      zoomControl: true,
      attributionControl: true,
    });

    // Light map tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    createIcons();

    if (stopsData.length > 0) {
      addStopMarkers();
      fitMapToRoute();
      // Draw road-following route (async)
      drawRoute();
    }

    const centerBtn = document.getElementById("center-map-btn");
    if (centerBtn) {
      centerBtn.addEventListener("click", centerOnDriver);
    }
  }

  // ── Create Icons ───────────────────────────────────────────────────────
  function createIcons() {
    icons.driver = L.divIcon({
      className: "driver-marker",
      html: `<div class="driver-marker-inner">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
               <path d="M12 2L4.5 20.3l.7.7L12 18l6.8 3 .7-.7L12 2z" fill="#0ea5e9"/>
             </svg>
           </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    icons.stopDefault = L.divIcon({
      className: "stop-marker",
      html: `<div class="stop-marker-inner stop-default">
             <div class="stop-marker-dot"></div>
           </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    icons.stopNext = L.divIcon({
      className: "stop-marker",
      html: `<div class="stop-marker-inner stop-next">
             <div class="stop-marker-dot"></div>
           </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    icons.stopVisited = L.divIcon({
      className: "stop-marker",
      html: `<div class="stop-marker-inner stop-visited">
             <div class="stop-marker-dot"></div>
           </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  // ── Draw Route Following Roads (OSRM) ───────────────────────────────
  async function drawRoute() {
    if (!map || stopsData.length < 2) return;

    // Build waypoints string for OSRM
    // Format: lng,lat;lng,lat;lng,lat
    const waypoints = stopsData
      .map((s) => `${s.longitude},${s.latitude}`)
      .join(";");

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`,
      );
      const data = await response.json();

      if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
        console.warn(
          "[NAV] OSRM routing failed, falling back to straight lines",
        );
        drawStraightRoute();
        return;
      }

      // Get the road-following coordinates
      const routeCoords = data.routes[0].geometry.coordinates.map(
        (coord) => [coord[1], coord[0]], // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
      );

      if (routePolyline) map.removeLayer(routePolyline);

      routePolyline = L.polyline(routeCoords, {
        color: "#0ea5e9",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Store route distance and duration from OSRM
      const routeInfo = data.routes[0];
      console.log(
        `[NAV] Route loaded: ${(routeInfo.distance / 1000).toFixed(1)} km, ` +
          `${Math.round(routeInfo.duration / 60)} min`,
      );
    } catch (err) {
      console.warn(
        "[NAV] OSRM fetch failed, falling back to straight lines:",
        err.message,
      );
      drawStraightRoute();
    }
  }

  // Fallback if OSRM is unavailable
  function drawStraightRoute() {
    if (!map || stopsData.length === 0) return;

    const coords = stopsData.map((s) => [s.latitude, s.longitude]);

    if (routePolyline) map.removeLayer(routePolyline);

    routePolyline = L.polyline(coords, {
      color: "#0ea5e9",
      weight: 4,
      opacity: 0.7,
      dashArray: "10 6",
      lineCap: "round",
    }).addTo(map);
  }

  // ── Add Stop Markers ───────────────────────────────────────────────────
  function addStopMarkers() {
    // Clear existing
    stopMarkers.forEach((m) => map.removeLayer(m));
    stopMarkers = [];

    stopsData.forEach((stop, idx) => {
      const icon = idx === 0 ? icons.stopNext : icons.stopDefault;

      const marker = L.marker([stop.latitude, stop.longitude], { icon })
        .bindPopup(
          `
          <div class="stop-popup">
            <strong>${stop.sequence_number}. ${stop.name}</strong><br/>
            <span>${stop.scheduled_arrival_time || "No schedule"}</span><br/>
            <span>Students: ${stop.students ? stop.students.length : 0}</span>
          </div>
        `,
        )
        .addTo(map);

      stopMarkers.push(marker);
    });
  }

  // ── Fit Map To Route ───────────────────────────────────────────────────
  function fitMapToRoute() {
    if (!map || stopsData.length === 0) return;

    const bounds = L.latLngBounds(
      stopsData.map((s) => [s.latitude, s.longitude]),
    );
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  // ── Start Navigation ──────────────────────────────────────────────────
  function startNavigation() {
    isNavigating = true;
    currentStopIdx = 0;

    // Show nav bar
    const navBar = document.getElementById("nav-bar");
    if (navBar) navBar.classList.remove("hidden");

    // Highlight first stop
    updateNextStop();
  }

  // ── Stop Navigation ───────────────────────────────────────────────────
  function stopNavigation() {
    isNavigating = false;
    currentStopIdx = 0;

    // Hide nav bar
    const navBar = document.getElementById("nav-bar");
    if (navBar) navBar.classList.add("hidden");

    // Reset stop markers
    stopMarkers.forEach((marker, idx) => {
      marker.setIcon(icons.stopDefault);
    });

    // Remove driver marker
    if (driverMarker) {
      map.removeLayer(driverMarker);
      driverMarker = null;
    }
  }

  // ── Update Driver Position ────────────────────────────────────────────
  function updateDriverPosition(lat, lng, heading) {
    if (!map) return;

    const latlng = L.latLng(lat, lng);

    if (!driverMarker) {
      driverMarker = L.marker(latlng, {
        icon: icons.driver,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      driverMarker.setLatLng(latlng);
    }

    // Rotate driver icon based on heading
    const markerEl = driverMarker.getElement();
    if (markerEl && heading) {
      markerEl.style.transform += ` rotate(${heading}deg)`;
    }

    // Check arrival at next stop
    if (isNavigating) {
      checkArrival(lat, lng);
      updateNavStats(lat, lng);
    }
  }

  // ── Check Arrival ─────────────────────────────────────────────────────
  function checkArrival(lat, lng) {
    if (currentStopIdx >= stopsData.length) return;

    const nextStop = stopsData[currentStopIdx];
    const distance = calculateDistance(
      lat,
      lng,
      nextStop.latitude,
      nextStop.longitude,
    );

    if (distance <= ARRIVAL_THRESHOLD_M) {
      console.log(`[NAV] Arrived at stop: ${nextStop.name}`);

      // Mark as visited
      if (stopMarkers[currentStopIdx]) {
        stopMarkers[currentStopIdx].setIcon(icons.stopVisited);
      }

      // Highlight stop card in list
      highlightStopCard(nextStop.id, true);

      // Move to next stop
      currentStopIdx++;

      if (currentStopIdx < stopsData.length) {
        updateNextStop();
      } else {
        // All stops visited
        updateNavComplete();
      }
    }
  }

  // ── Update Next Stop ──────────────────────────────────────────────────
  function updateNextStop() {
    if (currentStopIdx >= stopsData.length) return;

    const nextStop = stopsData[currentStopIdx];

    // Update nav bar
    const nameEl = document.getElementById("nav-next-stop");
    if (nameEl)
      nameEl.textContent = `${nextStop.sequence_number}. ${nextStop.name}`;

    // Update progress bar
    const progressEl = document.getElementById("nav-progress");
    if (progressEl) {
      const pct = (currentStopIdx / stopsData.length) * 100;
      progressEl.style.width = `${pct}%`;
    }

    // Update marker icons
    stopMarkers.forEach((marker, idx) => {
      if (idx < currentStopIdx) {
        marker.setIcon(icons.stopVisited);
      } else if (idx === currentStopIdx) {
        marker.setIcon(icons.stopNext);
      } else {
        marker.setIcon(icons.stopDefault);
      }
    });
  }

  // ── Update Nav Stats ──────────────────────────────────────────────────
  function updateNavStats(lat, lng) {
    if (currentStopIdx >= stopsData.length) return;

    const nextStop = stopsData[currentStopIdx];
    const distance = calculateDistance(
      lat,
      lng,
      nextStop.latitude,
      nextStop.longitude,
    );
    const gpsData = GPS.getLastPosition();
    const speed = gpsData ? gpsData.speed : 0;

    // Distance
    const distEl = document.getElementById("nav-distance");
    if (distEl) {
      distEl.textContent =
        distance >= 1000
          ? `${(distance / 1000).toFixed(1)} km`
          : `${Math.round(distance)} m`;
    }

    // ETA
    const etaEl = document.getElementById("nav-eta");
    if (etaEl) {
      if (speed > 5) {
        const etaMinutes = (distance / 1000 / speed) * 60;
        etaEl.textContent =
          etaMinutes < 1 ? "< 1 min" : `${Math.round(etaMinutes)} min`;
      } else {
        etaEl.textContent = "--";
      }
    }

    // Speed
    const speedEl = document.getElementById("nav-speed");
    if (speedEl) {
      speedEl.textContent = `${Math.round(speed)} km/h`;
    }
  }

  // ── Nav Complete ──────────────────────────────────────────────────────
  function updateNavComplete() {
    const nameEl = document.getElementById("nav-next-stop");
    if (nameEl) nameEl.textContent = "All stops completed! 🎉";

    const distEl = document.getElementById("nav-distance");
    if (distEl) distEl.textContent = "✓";

    const etaEl = document.getElementById("nav-eta");
    if (etaEl) etaEl.textContent = "Done";

    const progressEl = document.getElementById("nav-progress");
    if (progressEl) progressEl.style.width = "100%";
  }

  // ── Center On Driver ──────────────────────────────────────────────────
  function centerOnDriver() {
    if (!map || !driverMarker) {
      // No driver position yet, fit to route
      fitMapToRoute();
      return;
    }
    map.setView(driverMarker.getLatLng(), 16, { animate: true });
  }

  // ── Highlight Stop Card ───────────────────────────────────────────────
  function highlightStopCard(stopId, arrived) {
    const card = document.getElementById(`stop-${stopId}`);
    if (!card) return;

    if (arrived) {
      card.classList.add("stop-arrived");
      // Auto-expand to show students
      card.classList.add("expanded");
    }
  }

  // ── Distance Calculation (Haversine) ──────────────────────────────────
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

  // ── Public API ────────────────────────────────────────────────────────
  return {
    initMap,
    startNavigation,
    stopNavigation,
    updateDriverPosition,
    centerOnDriver,
    fitMapToRoute,
  };
})();
