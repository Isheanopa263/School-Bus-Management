import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { FormInput } from "../components/ui/FormGroup";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./LiveTracking.css";

function BusIcon(selected) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${selected ? "22px" : "18px"};height:${selected ? "22px" : "18px"};
      background:${selected ? "#6366f1" : "#6366f1"};
      border:3px solid white;border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      ${selected ? "animation:pulse 1.5s infinite" : ""}
    "></div>`,
    iconSize: [selected ? 22 : 18, selected ? 22 : 18],
    iconAnchor: [selected ? 11 : 9, selected ? 11 : 9],
  });
}

function FitBounds({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = locations.map((l) => [l.latitude, l.longitude]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [locations, map]);
  return null;
}

export default function LiveTracking() {
  const [locations, setLocations] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trail, setTrail] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadLocations();
    if (autoRefresh) {
      intervalRef.current = setInterval(loadLocations, 10000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  async function loadLocations() {
    try {
      const data = await apiFetch("/live-locations/all-latest");
      setLocations(data.locations || []);
    } catch (err) {
      console.warn("Load locations error:", err.message);
    }
  }

  async function loadTrail(tripId) {
    if (!tripId) {
      alert("No active trip for this bus");
      return;
    }
    try {
      const data = await apiFetch(`/live-locations/trail/${tripId}`);
      setTrail((data.trail || []).map((t) => [t.latitude, t.longitude]));
    } catch (err) {
      alert("Failed to load trail");
    }
  }

  function selectBus(loc) {
    setSelectedBus(loc);
    setTrail([]);
  }

  const filteredLocations = locations.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (l.bus_number || "").toLowerCase().includes(q) ||
      (l.driver_name || "").toLowerCase().includes(q) ||
      (l.route_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Live Tracking</h1>
          <p className="subtitle">Real-time bus locations</p>
        </div>
        <div className="tracking-controls">
          <Button size="sm" variant="secondary" onClick={loadLocations}>
            Refresh
          </Button>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="toggle-slider" />
            <span className="toggle-text">Auto-refresh</span>
          </label>
        </div>
      </div>

      <div className="tracking-layout">
        {/* Bus List Panel */}
        <div className="bus-panel">
          <Card>
            <div className="bus-panel-header">
              <h3>Active Buses</h3>
              <span className="bus-count">{locations.length}</span>
            </div>
            <div className="bus-search">
              <FormInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bus..."
              />
            </div>
            <div className="bus-list">
              {filteredLocations.length === 0 ? (
                <div className="bus-empty">
                  <p>🚌</p>
                  <p>No active buses</p>
                </div>
              ) : (
                filteredLocations.map((loc) => (
                  <div
                    key={loc.bus_id}
                    className={`bus-item ${selectedBus?.bus_id === loc.bus_id ? "active" : ""} ${loc.trip_status === "completed" ? "completed" : ""}`}
                    onClick={() => selectBus(loc)}
                  >
                    <div
                      className={`bus-dot ${loc.trip_status === "completed" ? "offline" : "online"}`}
                    />
                    <div className="bus-item-info">
                      <div className="bus-item-name">
                        {loc.bus_number || "Unknown"}
                      </div>
                      <div className="bus-item-meta">
                        {loc.driver_name || "No driver"} •{" "}
                        {loc.route_name || "No route"}
                      </div>
                      {loc.trip_status === "completed" && (
                        <div className="bus-item-status">Trip completed</div>
                      )}
                    </div>
                    <div className="bus-item-speed">
                      {loc.trip_status === "completed"
                        ? "Done"
                        : `${Math.round(loc.speed_kmh || 0)} km/h`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Map Panel */}
        <div className="map-panel">
          <MapContainer
            center={[17.05, 82.15]}
            zoom={11}
            className="tracking-map"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds locations={locations} />

            {locations.map((loc) => (
              <Marker
                key={loc.bus_id}
                position={[loc.latitude, loc.longitude]}
                icon={BusIcon(selectedBus?.bus_id === loc.bus_id)}
                eventHandlers={{ click: () => selectBus(loc) }}
              >
                <Popup>
                  <strong>🚌 {loc.bus_number}</strong>
                  <br />
                  Driver: {loc.driver_name || "-"}
                  <br />
                  Route: {loc.route_name || "-"}
                  <br />
                  Speed: {Math.round(loc.speed_kmh || 0)} km/h
                </Popup>
              </Marker>
            ))}

            {trail.length > 1 && (
              <Polyline
                positions={trail}
                color="#6366f1"
                weight={4}
                opacity={0.8}
              />
            )}
          </MapContainer>

          {/* Bus Info Overlay */}
          {selectedBus && (
            <div className="bus-info-overlay">
              <button
                className="overlay-close"
                onClick={() => {
                  setSelectedBus(null);
                  setTrail([]);
                }}
              >
                ×
              </button>
              <div className="overlay-header">
                <span className="overlay-bus-icon">🚌</span>
                <div>
                  <div className="overlay-bus-name">
                    {selectedBus.bus_number}
                  </div>
                  <div className="overlay-route">
                    {selectedBus.route_name || "No route"}
                  </div>
                </div>
              </div>
              <div className="overlay-stats">
                <div className="overlay-stat">
                  <span className="overlay-stat-label">Driver</span>
                  <span className="overlay-stat-value">
                    {selectedBus.driver_name || "-"}
                  </span>
                </div>
                <div className="overlay-stat">
                  <span className="overlay-stat-label">Speed</span>
                  <span className="overlay-stat-value">
                    {Math.round(selectedBus.speed_kmh || 0)} km/h
                  </span>
                </div>
                <div className="overlay-stat">
                  <span className="overlay-stat-label">Updated</span>
                  <span className="overlay-stat-value">
                    {new Date(selectedBus.recorded_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                fullWidth
                onClick={() => loadTrail(selectedBus.trip_id)}
                style={{ marginTop: "12px" }}
              >
                View Trail
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
