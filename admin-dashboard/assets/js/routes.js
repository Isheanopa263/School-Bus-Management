/**
 * Routes Module - Clean Rebuild
 * Route CRUD with OSRM path + Stop management with map
 */
(function () {
  let allRoutes = [];
  let editingRouteId = null;
  let deletingRouteId = null;
  let currentRouteId = null;
  let currentStops = [];

  // Route creation map
  let rMap = null;
  let rStart = null;
  let rEnd = null;
  let rLine = null;

  // Stops map
  let sMap = null;
  let sMarkers = [];
  let sLine = null;
  let sBaseLine = null;

  // ═══════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════

  init();

  async function init() {
    await loadRoutes();

    // Route modal buttons
    el("addRouteBtn").addEventListener("click", () => openRouteModal());
    el("saveRouteBtn").addEventListener("click", saveRoute);
    el("closeRouteModal").addEventListener("click", closeRouteModal);
    el("cancelRouteBtn").addEventListener("click", closeRouteModal);
    el("clearPointsBtn").addEventListener("click", clearPoints);

    // Stop modal buttons
    el("closeStopsModal").addEventListener("click", closeStopsModal);
    el("addStopBtn").addEventListener("click", addStop);

    // Delete modal buttons
    el("closeDeleteModal").addEventListener("click", () =>
      el("deleteModal").classList.remove("show"),
    );
    el("cancelDeleteBtn").addEventListener("click", () =>
      el("deleteModal").classList.remove("show"),
    );
    el("confirmDeleteBtn").addEventListener("click", confirmDelete);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROUTES TABLE
  // ═══════════════════════════════════════════════════════════════════════

  async function loadRoutes() {
    try {
      const data = await apiFetch("/routes");
      allRoutes = data.routes || [];
      renderTable();
    } catch (err) {
      el("routesTableBody").innerHTML =
        `<tr><td colspan="6" class="loading">Failed to load</td></tr>`;
    }
  }

  function renderTable() {
    const tbody = el("routesTableBody");
    if (allRoutes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="loading">No routes yet. Click "Add Route" to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = allRoutes
      .map(
        (r) => `
      <tr>
        <td><div class="route-name-cell"><div class="route-icon">📍</div><span class="route-name">${r.name}</span></div></td>
        <td><div class="metric-cell">${r.total_distance_km || "-"} <span class="metric-unit">km</span></div></td>
        <td><div class="metric-cell">${r.estimated_duration_min || "-"} <span class="metric-unit">min</span></div></td>
        <td><button class="stops-badge" onclick="openStops('${r.rid}','${esc(r.name)}')">📍 ${r.stop_count || 0} stops</button></td>
        <td><span class="badge ${r.is_active ? "badge-active" : "badge-inactive"}">${r.is_active ? "Active" : "Inactive"}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" onclick="openEdit('${r.rid}')" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete" onclick="openDelete('${r.rid}','${esc(r.name)}')" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`,
      )
      .join("");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROUTE CREATE / EDIT MODAL
  // ═══════════════════════════════════════════════════════════════════════

  function openRouteModal(route) {
    editingRouteId = route ? route.rid : null;
    el("routeModalTitle").textContent = route ? "Edit Route" : "Add Route";
    el("routeName").value = route ? route.name : "";
    el("routeDistance").value = route ? route.total_distance_km || "" : "";
    el("routeDuration").value = route ? route.estimated_duration_min || "" : "";
    el("routePathWKT").value = route ? route.route_path || "" : "";
    el("startCoords").textContent = "Click map";
    el("endCoords").textContent = "Click map";

    el("routeModal").classList.add("show");

    setTimeout(() => {
      if (rMap) rMap.remove();
      rMap = L.map("routeCreationMap").setView([17.05, 82.15], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        rMap,
      );
      rStart = null;
      rEnd = null;
      rLine = null;

      // If editing show existing path
      if (route && route.route_path) {
        const coords = parseWKT(route.route_path);
        if (coords.length > 1) {
          rLine = L.polyline(coords, { color: "#6366f1", weight: 5 }).addTo(
            rMap,
          );
          rStart = L.circleMarker(coords[0], {
            radius: 8,
            color: "#10b981",
            fillOpacity: 1,
          })
            .addTo(rMap)
            .bindPopup("Start");
          rEnd = L.circleMarker(coords[coords.length - 1], {
            radius: 8,
            color: "#ef4444",
            fillOpacity: 1,
          })
            .addTo(rMap)
            .bindPopup("End");
          rMap.fitBounds(rLine.getBounds(), { padding: [30, 30] });
          el("startCoords").textContent =
            `${coords[0][0].toFixed(4)}, ${coords[0][1].toFixed(4)}`;
          el("endCoords").textContent =
            `${coords[coords.length - 1][0].toFixed(4)}, ${coords[coords.length - 1][1].toFixed(4)}`;
        }
      }

      rMap.on("click", handleRouteMapClick);
    }, 300);
  }

  async function handleRouteMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (!rStart) {
      rStart = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#10b981",
        fillOpacity: 1,
      })
        .addTo(rMap)
        .bindPopup("Start");
      el("startCoords").textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } else if (!rEnd) {
      rEnd = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#ef4444",
        fillOpacity: 1,
      })
        .addTo(rMap)
        .bindPopup("End");
      el("endCoords").textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      // Calculate road path via OSRM
      const startLL = rStart.getLatLng();
      const endLL = rEnd.getLatLng();
      const path = await getOSRMPath([startLL, endLL]);

      if (path) {
        el("routeDistance").value = path.distance;
        el("routeDuration").value = path.duration;
        el("routePathWKT").value = path.wkt;
        if (rLine) rMap.removeLayer(rLine);
        rLine = L.geoJSON(path.geometry, {
          style: { color: "#6366f1", weight: 5 },
        }).addTo(rMap);
        rMap.fitBounds(rLine.getBounds(), { padding: [20, 20] });
      }
    }
  }

  function clearPoints() {
    if (rStart) rMap.removeLayer(rStart);
    if (rEnd) rMap.removeLayer(rEnd);
    if (rLine) rMap.removeLayer(rLine);
    rStart = null;
    rEnd = null;
    rLine = null;
    el("startCoords").textContent = "Click map";
    el("endCoords").textContent = "Click map";
    el("routeDistance").value = "";
    el("routeDuration").value = "";
    el("routePathWKT").value = "";
  }

  async function saveRoute() {
    const name = el("routeName").value.trim();
    const wkt = el("routePathWKT").value;

    if (!name) return alert("Route name is required");
    if (!wkt) return alert("Please set start and end points on the map");

    const body = {
      name,
      route_path: wkt,
      total_distance_km: parseFloat(el("routeDistance").value) || 0,
      estimated_duration_min: parseInt(el("routeDuration").value) || 0,
    };

    try {
      if (editingRouteId) {
        await apiFetch(`/routes/${editingRouteId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/routes", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      closeRouteModal();
      await loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to save route");
    }
  }

  function closeRouteModal() {
    el("routeModal").classList.remove("show");
    editingRouteId = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DELETE ROUTE
  // ═══════════════════════════════════════════════════════════════════════

  window.openDelete = function (id, name) {
    deletingRouteId = id;
    el("deleteRouteName").textContent = name;
    el("deleteModal").classList.add("show");
  };

  async function confirmDelete() {
    if (!deletingRouteId) return;
    try {
      await apiFetch(`/routes/${deletingRouteId}`, { method: "DELETE" });
      el("deleteModal").classList.remove("show");
      await loadRoutes();
    } catch (err) {
      alert(err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STOPS MODAL
  // ═══════════════════════════════════════════════════════════════════════

  window.openStops = async function (routeId, routeName) {
    currentRouteId = routeId;
    el("stopsModalTitle").textContent = `Stops - ${routeName}`;
    el("stopsModal").classList.add("show");

    await loadStops();

    // Init map
    setTimeout(() => {
      if (sMap) sMap.remove();
      sMap = L.map("stopsMap").setView([17.05, 82.15], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        sMap,
      );

      // Draw base route path
      const routeObj = allRoutes.find((r) => r.rid === routeId);
      const baseCoords = parseWKT(routeObj ? routeObj.route_path : "");
      if (baseCoords.length > 1) {
        sBaseLine = L.polyline(baseCoords, {
          color: "#94a3b8",
          weight: 5,
          opacity: 0.4,
        }).addTo(sMap);
        L.circleMarker(baseCoords[0], {
          radius: 6,
          color: "#10b981",
          fillOpacity: 1,
        })
          .addTo(sMap)
          .bindPopup("Route Start");
        L.circleMarker(baseCoords[baseCoords.length - 1], {
          radius: 6,
          color: "#ef4444",
          fillOpacity: 1,
        })
          .addTo(sMap)
          .bindPopup("Route End");
        sMap.fitBounds(sBaseLine.getBounds(), { padding: [30, 30] });
      }

      sMap.on("click", (e) => {
        el("stopLat").value = e.latlng.lat.toFixed(6);
        el("stopLng").value = e.latlng.lng.toFixed(6);
      });

      sMap.invalidateSize();
      drawStopsOnMap();
    }, 300);
  };

  async function loadStops() {
    try {
      const data = await apiFetch(`/stops?route_id=${currentRouteId}`);
      currentStops = data.stops || [];
    } catch (err) {
      currentStops = [];
    }
    renderStopsList();
  }

  function renderStopsList() {
    el("stopsCount").textContent = currentStops.length;
    const container = el("stopsList");

    if (currentStops.length === 0) {
      container.innerHTML = `<div class="stops-empty">No stops yet. Click on the map and add one.</div>`;
      return;
    }

    container.innerHTML = currentStops
      .map(
        (s) => `
      <div class="stop-item">
        <div class="stop-order">${s.sequence_number}</div>
        <div class="stop-item-info">
          <div class="stop-item-name">${s.name}</div>
          <div class="stop-item-coords">${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}</div>
        </div>
        <button class="stop-delete-btn" onclick="removeStop('${s.id}')">✕</button>
      </div>`,
      )
      .join("");
  }

  function drawStopsOnMap() {
    if (!sMap) return;
    sMarkers.forEach((m) => sMap.removeLayer(m));
    sMarkers = [];
    if (sLine) sMap.removeLayer(sLine);

    if (currentStops.length === 0) return;

    const points = [];
    currentStops.forEach((s) => {
      const pos = [parseFloat(s.latitude), parseFloat(s.longitude)];
      points.push(pos);

      const marker = L.marker(pos, {
        icon: L.divIcon({
          className: "stop-map-marker",
          html: `<div style="width:26px;height:26px;border-radius:50%;background:#6366f1;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${s.sequence_number}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .addTo(sMap)
        .bindPopup(`<strong>${s.sequence_number}. ${s.name}</strong>`);

      sMarkers.push(marker);
    });

    // Connect stops with dashed line
    if (points.length > 1) {
      sLine = L.polyline(points, {
        color: "#6366f1",
        weight: 2,
        dashArray: "6, 6",
      }).addTo(sMap);
    }
  }

  async function addStop() {
    const name = el("stopName").value.trim();
    const lat = el("stopLat").value;
    const lng = el("stopLng").value;
    const time = el("stopTime").value;

    if (!name || !lat || !lng) {
      return alert("Enter a name and click on the map to set position");
    }

    try {
      await apiFetch("/stops", {
        method: "POST",
        body: JSON.stringify({
          route_id: currentRouteId,
          name,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          sequence_number: currentStops.length + 1,
          scheduled_arrival_time: time || null,
        }),
      });

      el("stopName").value = "";
      el("stopLat").value = "";
      el("stopLng").value = "";
      el("stopTime").value = "";

      await loadStops();
      drawStopsOnMap();
      await loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to add stop");
    }
  }

  window.removeStop = async function (stopId) {
    if (!confirm("Delete this stop?")) return;
    try {
      await apiFetch(`/stops/${stopId}`, { method: "DELETE" });
      await loadStops();
      drawStopsOnMap();
      await loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to delete stop");
    }
  };

  function closeStopsModal() {
    el("stopsModal").classList.remove("show");
    if (sMap) {
      sMap.remove();
      sMap = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GLOBAL ONCLICK HANDLERS (Accessible from HTML)
  // ═══════════════════════════════════════════════════════════════════════

  window.openEdit = function (id) {
    const route = allRoutes.find((r) => r.rid === id);
    if (route) openRouteModal(route);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  async function getOSRMPath(points) {
    try {
      const query = points.map((p) => `${p.lng},${p.lat}`).join(";");
      const resp = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${query}?overview=full&geometries=geojson`,
      );
      const data = await resp.json();
      if (data.code !== "Ok") return null;
      const r = data.routes[0];
      return {
        distance: (r.distance / 1000).toFixed(2),
        duration: Math.round(r.duration / 60),
        geometry: r.geometry,
        wkt: `LINESTRING(${r.geometry.coordinates.map((c) => `${c[0]} ${c[1]}`).join(", ")})`,
      };
    } catch (err) {
      console.error("OSRM error:", err);
      return null;
    }
  }

  function parseWKT(wkt) {
    if (!wkt) return [];
    try {
      const content = wkt.match(/\((.*)\)/)[1];
      return content.split(",").map((p) => {
        const [lng, lat] = p.trim().split(" ");
        return [parseFloat(lat), parseFloat(lng)];
      });
    } catch (e) {
      return [];
    }
  }

  function el(id) {
    return document.getElementById(id);
  }

  function esc(str) {
    return (str || "").replace(/'/g, "\\'");
  }
})();
