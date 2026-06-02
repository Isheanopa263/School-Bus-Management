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
  let routeMeta = null; // ← stores assignment object (contains route_path WKT)
  let startEndMarkers = []; // ← for green start + red end dots
  let currentStopIdx = 0;
  let isNavigating = false;

  const ARRIVAL_THRESHOLD_M = 100;
  const DEFAULT_ZOOM = 14;

  const icons = {
    driver: null,
    stopDefault: null,
    stopNext: null,
    stopVisited: null,
  };

  // ── Initialize Map ────────────────────────────────────────────────────
  function initMap(stops, route) {
    const mapEl = document.getElementById("route-map");
    if (!mapEl) return;

    if (map) {
      map.remove();
      map = null;
    }

    stopsData = stops || [];
    routeMeta = route || null;
    stopMarkers = [];
    startEndMarkers = [];
    currentStopIdx = 0;

    map = L.map("route-map", {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    createIcons();

    if (stopsData.length > 0) {
      addStopMarkers();
      fitMapToRoute();
      drawRoute();
    }

    const centerBtn = document.getElementById("center-map-btn");
    if (centerBtn) {
      centerBtn.addEventListener("click", centerOnDriver);
    }
  }

  // ── Create Icons ──────────────────────────────────────────────────────
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

  // ── Helpers: parse WKT LINESTRING into [[lat,lng], ...] ────────────────
  function parseWKTLineString(wkt) {
    if (!wkt) return [];
    try {
      const content = wkt.match(/\((.*)\)/)[1];
      return content.split(",").map((p) => {
        const [lng, lat] = p.trim().split(" ");
        return [parseFloat(lat), parseFloat(lng)];
      });
    } catch {
      return [];
    }
  }

  // ── Draw Route: Start -> Stops -> End ─────────────────────────────────
  async function drawRoute() {
    if (!map) return;

    // Build waypoints
    const waypoints = [];

    const routePathCoords = routeMeta?.route_path
      ? parseWKTLineString(routeMeta.route_path)
      : [];

    // Route start
    if (routePathCoords.length > 0) {
      waypoints.push({
        lat: routePathCoords[0][0],
        lng: routePathCoords[0][1],
      });
    }

    // All stops in order
    stopsData.forEach((s) => {
      waypoints.push({ lat: s.latitude, lng: s.longitude });
    });

    // Route end
    if (routePathCoords.length > 1) {
      const last = routePathCoords[routePathCoords.length - 1];
      waypoints.push({ lat: last[0], lng: last[1] });
    }

    if (waypoints.length < 2) return;

    // Add start/end visual markers
    if (routePathCoords.length > 0) {
      addStartEndMarkers(routePathCoords);
    }

    // OSRM request
    try {
      const query = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${query}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        console.warn(
          "[NAV] OSRM routing failed, falling back to straight lines",
        );
        drawStraightRoute();
        return;
      }

      const routeCoords = data.routes[0].geometry.coordinates.map((c) => [
        c[1],
        c[0],
      ]);

      if (routePolyline) map.removeLayer(routePolyline);

      routePolyline = L.polyline(routeCoords, {
        color: "#0ea5e9",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Fit map to full route
      map.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });

      const info = data.routes[0];
      console.log(
        `[NAV] Route loaded: ${(info.distance / 1000).toFixed(1)} km, ` +
          `${Math.round(info.duration / 60)} min`,
      );
    } catch (err) {
      console.warn("[NAV] OSRM fetch failed:", err.message);
      drawStraightRoute();
    }
  }

  // ── Fallback: dashed straight lines ───────────────────────────────────
  function drawStraightRoute() {
    if (!map) return;

    const coords = [];

    const routePathCoords = routeMeta?.route_path
      ? parseWKTLineString(routeMeta.route_path)
      : [];

    if (routePathCoords.length > 0) coords.push(routePathCoords[0]);

    stopsData.forEach((s) => coords.push([s.latitude, s.longitude]));

    if (routePathCoords.length > 1) {
      coords.push(routePathCoords[routePathCoords.length - 1]);
    }

    if (coords.length < 2) return;

    if (routePolyline) map.removeLayer(routePolyline);

    routePolyline = L.polyline(coords, {
      color: "#0ea5e9",
      weight: 4,
      opacity: 0.7,
      dashArray: "10 6",
      lineCap: "round",
    }).addTo(map);
  }

  // ── Start / End Visual Markers ────────────────────────────────────────
  function addStartEndMarkers(coords) {
    // Clear old
    startEndMarkers.forEach((m) => map.removeLayer(m));
    startEndMarkers = [];

    if (!coords || coords.length < 2) return;

    const startMarker = L.circleMarker(coords[0], {
      radius: 7,
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 1,
      weight: 2,
    })
      .addTo(map)
      .bindPopup("Route Start");

    const endMarker = L.circleMarker(coords[coords.length - 1], {
      radius: 7,
      color: "#ef4444",
      fillColor: "#ef4444",
      fillOpacity: 1,
      weight: 2,
    })
      .addTo(map)
      .bindPopup("Route End");

    startEndMarkers.push(startMarker, endMarker);
  }

  // ── Stop Markers ──────────────────────────────────────────────────────
  function addStopMarkers() {
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

  // ── Fit map bounds to stops + route start/end ─────────────────────────
  function fitMapToRoute() {
    if (!map) return;

    const points = [];
    stopsData.forEach((s) => points.push([s.latitude, s.longitude]));

    const routePathCoords = routeMeta?.route_path
      ? parseWKTLineString(routeMeta.route_path)
      : [];

    if (routePathCoords.length > 0) {
      points.push(routePathCoords[0]);
      points.push(routePathCoords[routePathCoords.length - 1]);
    }

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  // ── Start Navigation ──────────────────────────────────────────────────
  function startNavigation() {
    isNavigating = true;
    currentStopIdx = 0;

    const navBar = document.getElementById("nav-bar");
    if (navBar) navBar.classList.remove("hidden");

    updateNextStop();
  }

  // ── Stop Navigation ───────────────────────────────────────────────────
  function stopNavigation() {
    isNavigating = false;
    currentStopIdx = 0;

    const navBar = document.getElementById("nav-bar");
    if (navBar) navBar.classList.add("hidden");

    stopMarkers.forEach((marker) => marker.setIcon(icons.stopDefault));

    if (driverMarker) {
      map.removeLayer(driverMarker);
      driverMarker = null;
    }
  }

  // ── Driver Position ───────────────────────────────────────────────────
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

    const markerEl = driverMarker.getElement();
    if (markerEl && heading) {
      markerEl.style.transform += ` rotate(${heading}deg)`;
    }

    if (isNavigating) {
      checkArrival(lat, lng);
      updateNavStats(lat, lng);
    }
  }

  // ── Arrival ───────────────────────────────────────────────────────────
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

      if (stopMarkers[currentStopIdx]) {
        stopMarkers[currentStopIdx].setIcon(icons.stopVisited);
      }

      highlightStopCard(nextStop.id, true);

      currentStopIdx++;

      if (currentStopIdx < stopsData.length) {
        updateNextStop();
      } else {
        updateNavComplete();
      }
    }
  }

  function updateNextStop() {
    if (currentStopIdx >= stopsData.length) return;

    const nextStop = stopsData[currentStopIdx];

    const nameEl = document.getElementById("nav-next-stop");
    if (nameEl) {
      nameEl.textContent = `${nextStop.sequence_number}. ${nextStop.name}`;
    }

    const progressEl = document.getElementById("nav-progress");
    if (progressEl) {
      const pct = (currentStopIdx / stopsData.length) * 100;
      progressEl.style.width = `${pct}%`;
    }

    stopMarkers.forEach((marker, idx) => {
      if (idx < currentStopIdx) marker.setIcon(icons.stopVisited);
      else if (idx === currentStopIdx) marker.setIcon(icons.stopNext);
      else marker.setIcon(icons.stopDefault);
    });
  }

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

    const distEl = document.getElementById("nav-distance");
    if (distEl) {
      distEl.textContent =
        distance >= 1000
          ? `${(distance / 1000).toFixed(1)} km`
          : `${Math.round(distance)} m`;
    }

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

    const speedEl = document.getElementById("nav-speed");
    if (speedEl) speedEl.textContent = `${Math.round(speed)} km/h`;
  }

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

  function centerOnDriver() {
    if (!map || !driverMarker) {
      fitMapToRoute();
      return;
    }
    map.setView(driverMarker.getLatLng(), 16, { animate: true });
  }

  function highlightStopCard(stopId, arrived) {
    const card = document.getElementById(`stop-${stopId}`);
    if (!card) return;
    if (arrived) {
      card.classList.add("stop-arrived");
      card.classList.add("expanded");
    }
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
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

  return {
    initMap,
    startNavigation,
    stopNavigation,
    updateDriverPosition,
    centerOnDriver,
    fitMapToRoute,
  };
})();
