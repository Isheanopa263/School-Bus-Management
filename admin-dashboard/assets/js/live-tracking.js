let map;
let markers = {};
let socket;
let activeTrips = [];

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth()) return;
  initMap();
  initSocket();
  loadActiveTrips();
});

function initMap() {
  // Default to Hyderabad if no buses yet
  map = L.map("map").setView([17.385, 78.4867], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
}

function initSocket() {
  const token = localStorage.getItem("token");
  socket = io("http://localhost:3000", {
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("Socket connected");
    document.getElementById("wsStatus").classList.add("connected");
    socket.emit("join-room", "admin");
  });

  socket.on("disconnect", () => {
    document.getElementById("wsStatus").classList.remove("connected");
  });

  socket.on("bus-location-update", (data) => {
    updateBusMarker(data);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket error:", err);
  });
}

async function loadActiveTrips() {
  try {
    const res = await apiFetch("/api/trips?status=active");
    activeTrips = res.trips || [];
    renderTripsList();
    document.getElementById("activeBusesCount").textContent =
      `${activeTrips.length} active buses`;
  } catch (err) {
    console.error("Load trips error:", err);
    document.getElementById("tripsList").innerHTML =
      '<div class="empty">Failed to load trips</div>';
  }
}

function renderTripsList() {
  const container = document.getElementById("tripsList");

  if (!activeTrips.length) {
    container.innerHTML = '<div class="empty">No active trips</div>';
    return;
  }

  container.innerHTML = activeTrips
    .map(
      (trip) => `
    <div class="trip-item" onclick="focusBus(${trip.id})">
      <div class="trip-header">
        <strong>Bus ${trip.bus_number}</strong>
        <span class="badge ${trip.status}">${trip.status}</span>
      </div>
      <div class="trip-details">
        Driver: ${trip.driver_name || "Unassigned"}<br>
        Route: ${trip.route_name || "N/A"}
      </div>
    </div>
  `,
    )
    .join("");
}

function updateBusMarker(data) {
  const { busId, latitude, longitude, speed, heading } = data;

  if (!latitude || !longitude) return;

  if (markers[busId]) {
    // Update existing marker
    markers[busId].setLatLng([latitude, longitude]);
  } else {
    // Create new marker
    const busIcon = L.divIcon({
      className: "bus-marker",
      html: '<div class="bus-icon">🚌</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    markers[busId] = L.marker([latitude, longitude], { icon: busIcon })
      .addTo(map)
      .bindPopup(
        `<b>Bus ${data.busNumber || busId}</b><br>Speed: ${speed || 0} km/h`,
      );
  }

  // Fit map to all markers on first load
  if (Object.keys(markers).length === 1) {
    map.setView([latitude, longitude], 13);
  }
}

function focusBus(tripId) {
  const trip = activeTrips.find((t) => t.id === tripId);
  if (!trip || !markers[trip.bus_id]) return;

  const marker = markers[trip.bus_id];
  map.setView(marker.getLatLng(), 15);
  marker.openPopup();
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});
