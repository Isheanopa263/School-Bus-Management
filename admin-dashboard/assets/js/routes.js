const API_BASE = "http://localhost:3000";

let routes = [];
let currentRouteId = null;
let routeMap = null;
let routePolyline = null;
let routePoints = [];

document.addEventListener("DOMContentLoaded", () => {
  console.log("Routes page loaded");
  loadRoutes();
});

async function loadRoutes() {
  try {
    console.log("Fetching routes...");
    const res = await apiFetch("/api/routes");
    console.log("Routes API response:", res);
    routes = res.routes || [];
    console.log("Parsed routes:", routes);
    renderTable();
  } catch (err) {
    console.error("Load routes error:", err);
    document.getElementById("routesTableBody").innerHTML =
      `<tr><td colspan="5" class="error">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderTable() {
  console.log("Rendering table with", routes.length, "routes");
  const tbody = document.getElementById("routesTableBody");

  if (!routes || routes.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="loading">No routes found. Add one to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = routes
    .map(
      (route) => `
    <tr>
      <td><strong>${route.name}</strong></td>
      <td>${route.total_distance_km ? route.total_distance_km + " km" : "-"}</td>
      <td>${route.estimated_duration_min ? route.estimated_duration_min + " min" : "-"}</td>
      <td>${
        route.is_active
          ? '<span class="badge active">Active</span>'
          : '<span class="badge inactive">Inactive</span>'
      }
      </td>
      <td>
        <div class="actions">
          <button class="btn-icon edit-btn" data-id="${route.rid}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5l3 3L13 14l-4 1l1-4l8.5-8.5z"></path>
            </svg>
          </button>
          <button class="btn-icon delete delete-btn" data-id="${route.rid}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  attachEventListeners();
}

function attachEventListeners() {
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => editRoute(e.currentTarget.dataset.id));
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      deleteRoute(e.currentTarget.dataset.id),
    );
  });
}

document
  .getElementById("addRouteBtn")
  ?.addEventListener("click", () => openModal());
document.getElementById("closeModal")?.addEventListener("click", closeModal);
document.getElementById("cancelBtn")?.addEventListener("click", closeModal);

function openModal(route = null) {
  const modal = document.getElementById("routeModal");
  const form = document.getElementById("routeForm");
  form.reset();
  routePoints = [];

  if (route) {
    document.getElementById("modalTitle").textContent = "Edit Route";
    document.getElementById("routeId").value = route.rid;
    document.getElementById("routeName").value = route.name;
    document.getElementById("routePath").value = route.route_path || "";
    document.getElementById("totalDistance").value =
      route.total_distance_km || "";
    document.getElementById("estimatedDuration").value =
      route.estimated_duration_min || "";
    if (route.route_path) parseWKTToPoints(route.route_path);
  } else {
    document.getElementById("modalTitle").textContent = "Add Route";
    document.getElementById("routeId").value = "";
  }

  modal.classList.add("active");
  setTimeout(() => {
    initRouteMap();
    if (routePoints.length > 0) drawRouteOnMap();
  }, 150);
}

function initRouteMap() {
  if (routeMap) routeMap.remove();

  routeMap = L.map("routeMap").setView([17.0005, 81.804], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(routeMap);

  L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Search for a place...",
  })
    .on("markgeocode", function (e) {
      routeMap.setView(e.geocode.center, 13);
    })
    .addTo(routeMap);

  routeMap.on("click", (e) => {
    routePoints.push([e.latlng.lng, e.latlng.lat]);
    updateRoutePath();
    drawRouteOnMap();
  });

  setTimeout(() => routeMap.invalidateSize(), 100);
}

function drawRouteOnMap() {
  if (routePolyline) routeMap.removeLayer(routePolyline);
  routeMap.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) routeMap.removeLayer(layer);
  });

  if (routePoints.length > 0) {
    const latLngs = routePoints.map((p) => [p[1], p[0]]);
    routePolyline = L.polyline(latLngs, { color: "#6366f1", weight: 4 }).addTo(
      routeMap,
    );

    latLngs.forEach((latLng, idx) => {
      L.circleMarker(latLng, {
        radius: 6,
        fillColor: "#6366f1",
        color: "white",
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(routeMap)
        .bindTooltip(`Point ${idx + 1}`);
    });

    if (latLngs.length > 1) {
      routeMap.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
    }
  }
}

async function updateRoutePath() {
  if (routePoints.length < 2) {
    document.getElementById("routePath").value =
      routePoints.length === 1
        ? `POINT(${routePoints[0][0]} ${routePoints[0][1]})`
        : "";
    document.getElementById("totalDistance").value = "";
    return;
  }

  // Call OSRM to get road-snapped route
  const coords = routePoints.map((p) => `${p[0]},${p[1]}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes[0]) {
      const route = data.routes[0];

      // Update WKT with actual road geometry
      const wktCoords = route.geometry.coordinates
        .map((c) => `${c[0]} ${c[1]}`)
        .join(", ");
      document.getElementById("routePath").value = `LINESTRING(${wktCoords})`;

      // OSRM gives distance in meters
      document.getElementById("totalDistance").value = (
        route.distance / 1000
      ).toFixed(2);

      // Update map with road geometry
      drawRouteOnMap(route.geometry.coordinates);
    } else {
      // Fallback to straight line if OSRM fails
      fallbackStraightLine();
    }
  } catch (err) {
    console.error("OSRM error:", err);
    fallbackStraightLine();
  }
}

function fallbackStraightLine() {
  const wkt = `LINESTRING(${routePoints.map((p) => `${p[0]} ${p[1]}`).join(", ")})`;
  document.getElementById("routePath").value = wkt;

  let distance = 0;
  for (let i = 1; i < routePoints.length; i++) {
    distance += routeMap.distance(
      [routePoints[i - 1][1], routePoints[i - 1][0]],
      [routePoints[i][1], routePoints[i][0]],
    );
  }
  document.getElementById("totalDistance").value = (distance / 1000).toFixed(2);
  drawRouteOnMap(routePoints);
}

function drawRouteOnMap(coordinates = null) {
  if (routePolyline) routeMap.removeLayer(routePolyline);
  routeMap.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) routeMap.removeLayer(layer);
  });

  const coordsToDraw = coordinates || routePoints;
  if (coordsToDraw.length === 0) return;

  const latLngs = coordinates
    ? coordinates.map((p) => [p[1], p[0]])
    : routePoints.map((p) => [p[1], p[0]]);

  routePolyline = L.polyline(latLngs, { color: "#6366f1", weight: 4 }).addTo(
    routeMap,
  );

  // Draw markers only on original waypoints
  routePoints.forEach((p, idx) => {
    L.circleMarker([p[1], p[0]], {
      radius: 6,
      fillColor: "#6366f1",
      color: "white",
      weight: 2,
      fillOpacity: 1,
    })
      .addTo(routeMap)
      .bindTooltip(`Stop ${idx + 1}`);
  });

  if (latLngs.length > 1) {
    routeMap.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  }
}

function parseWKTToPoints(wkt) {
  const match = wkt.match(/LINESTRING\s*\((.*)\)/i);
  if (!match) return;
  routePoints = match[1].split(",").map((pair) => {
    const [lng, lat] = pair.trim().split(" ").map(Number);
    return [lng, lat];
  });
}

document.getElementById("clearPathBtn")?.addEventListener("click", () => {
  routePoints = [];
  updateRoutePath();
  drawRouteOnMap();
});

document.getElementById("undoPointBtn")?.addEventListener("click", () => {
  routePoints.pop();
  updateRoutePath();
  drawRouteOnMap();
});

function closeModal() {
  document.getElementById("routeModal").classList.remove("active");
  routePoints = [];
  if (routeMap) {
    routeMap.remove();
    routeMap = null;
  }
}

function editRoute(id) {
  const route = routes.find((r) => r.rid === id);
  if (route) openModal(route);
}

document.getElementById("routeForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("routeId").value;
  const data = {
    name: document.getElementById("routeName").value,
    route_path: document.getElementById("routePath").value,
    total_distance_km:
      parseFloat(document.getElementById("totalDistance").value) || null,
    estimated_duration_min:
      parseInt(document.getElementById("estimatedDuration").value) || null,
  };

  try {
    if (id) {
      await apiFetch(`/api/routes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } else {
      await apiFetch("/api/routes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    closeModal();
    loadRoutes();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function deleteRoute(id) {
  if (!confirm("Delete this route?")) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/routes/${id}`, {
      // Use API_BASE
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 204) {
      loadRoutes();
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    loadRoutes();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Error: " + err.message);
  }
}
