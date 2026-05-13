// assets/js/map.js

let map;
let socket;
const busMarkers = new Map();

// Initialize map
function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) {
    console.error("Map container #map not found");
    return;
  }

  // Center on Amalapuram by default
  map = L.map("map").setView([16.5784, 82.0065], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  console.log("Map initialized");
}

// Connect to Socket.IO
function connectSocket() {
  const token = localStorage.getItem("token");

  socket = io("http://localhost:3000", {
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("Socket connected");
    document.getElementById("socketStatus").textContent = "Connected";
    document.querySelector(".pulse")?.classList.add("connected");

    // Subscribe to all buses
    socket.emit("subscribe:all-buses");
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
    document.getElementById("socketStatus").textContent = "Disconnected";
    document.querySelector(".pulse")?.classList.remove("connected");
  });

  socket.on("bus:location", (data) => {
    updateBusMarker(data);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket error:", err.message);
    document.getElementById("socketStatus").textContent = "Error";
  });
}

// Update or create bus marker
function updateBusMarker(data) {
  const { busId, latitude, longitude, speed, heading, timestamp } = data;

  if (!latitude || !longitude) return;

  const latlng = [latitude, longitude];
  const isActive = Date.now() - new Date(timestamp).getTime() < 300000; // 5 min

  // Custom bus icon
  const busIcon = L.divIcon({
    className: "bus-marker",
    html: `
      <div class="bus-icon ${isActive ? "active" : "idle"}" style="transform: rotate(${heading || 0}deg)">
        <svg width="24" height="24" viewBox="0 0 24" fill="none">
          <path d="M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" stroke="white" stroke-width="2"/>
          <path d="M4 16h16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  if (busMarkers.has(busId)) {
    // Update existing marker
    busMarkers.get(busId).setLatLng(latlng).setIcon(busIcon);
  } else {
    // Create new marker
    const marker = L.marker(latlng, { icon: busIcon }).addTo(map).bindPopup(`
        <div style="font-family: Inter, sans-serif;">
          <strong>Bus ${busId}</strong><br>
          Speed: ${speed || 0} km/h<br>
          Updated: ${new Date(timestamp).toLocaleTimeString()}
        </div>
      `);
    busMarkers.set(busId, marker);
  }

  // Update bus count
  document.getElementById("busCount").textContent = busMarkers.size;
}

// Load initial bus positions
async function loadInitialBuses() {
  try {
    const res = await apiFetch("/api/buses");
    res.buses?.forEach((bus) => {
      if (bus.lastLatitude && bus.lastLongitude) {
        updateBusMarker({
          busId: bus.id,
          latitude: bus.lastLatitude,
          longitude: bus.lastLongitude,
          speed: bus.lastSpeed,
          heading: bus.lastHeading,
          timestamp: bus.lastUpdatedAt,
        });
      }
    });
  } catch (err) {
    console.error("Failed to load buses:", err);
  }
}

// Initialize everything
document.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth()) return;

  initMap();
  connectSocket();
  loadInitialBuses();
});
