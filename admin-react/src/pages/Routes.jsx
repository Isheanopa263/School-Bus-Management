import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { FormGroup, FormInput, FormRow } from "../components/ui/FormGroup";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Routes.css";

// Fix leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function parseWKT(wkt) {
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

// Map click handler component
function MapClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => onClick(e.latlng),
  });
  return null;
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [routeModal, setRouteModal] = useState(false);
  const [stopsModal, setStopsModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Route creation
  const [routeName, setRouteName] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [routePathWKT, setRoutePathWKT] = useState("");
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routePath, setRoutePath] = useState([]);

  // Stops management
  const [currentStops, setCurrentStops] = useState([]);
  const [stopName, setStopName] = useState("");
  const [stopLat, setStopLat] = useState("");
  const [stopLng, setStopLng] = useState("");
  const [stopTime, setStopTime] = useState("");
  const [basePath, setBasePath] = useState([]);

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    try {
      const data = await apiFetch("/routes");
      setRoutes(data.routes || []);
    } catch (err) {
      console.error("Load routes error:", err);
    }
  }

  // ── Route CRUD ────────────────────────────────────────────────────────

  function openAddRoute() {
    setEditing(null);
    setRouteName("");
    setRouteDistance("");
    setRouteDuration("");
    setRoutePathWKT("");
    setStartPoint(null);
    setEndPoint(null);
    setRoutePath([]);
    setRouteModal(true);
  }

  function openEditRoute(route) {
    setEditing(route);
    setRouteName(route.name);
    setRouteDistance(route.total_distance_km || "");
    setRouteDuration(route.estimated_duration_min || "");
    setRoutePathWKT(route.route_path || "");

    const coords = parseWKT(route.route_path);
    if (coords.length > 1) {
      setStartPoint(coords[0]);
      setEndPoint(coords[coords.length - 1]);
      setRoutePath(coords);
    } else {
      setStartPoint(null);
      setEndPoint(null);
      setRoutePath([]);
    }

    setRouteModal(true);
  }

  async function handleMapClick(latlng) {
    if (!startPoint) {
      setStartPoint([latlng.lat, latlng.lng]);
    } else if (!endPoint) {
      setEndPoint([latlng.lat, latlng.lng]);
      await calculateOSRMPath([latlng.lat, latlng.lng]);
    }
  }

  async function calculateOSRMPath(end) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startPoint[1]},${startPoint[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.code === "Ok") {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
        setRoutePath(coords);
        setRouteDistance((route.distance / 1000).toFixed(2));
        setRouteDuration(Math.round(route.duration / 60));

        const wkt = `LINESTRING(${route.geometry.coordinates.map((c) => `${c[0]} ${c[1]}`).join(", ")})`;
        setRoutePathWKT(wkt);
      }
    } catch (err) {
      console.error("OSRM error:", err);
    }
  }

  function resetPoints() {
    setStartPoint(null);
    setEndPoint(null);
    setRoutePath([]);
    setRouteDistance("");
    setRouteDuration("");
    setRoutePathWKT("");
  }

  async function handleSaveRoute() {
    if (!routeName || !routePathWKT) {
      alert("Please set name and start/end points on map");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: routeName,
        route_path: routePathWKT,
        total_distance_km: parseFloat(routeDistance) || 0,
        estimated_duration_min: parseInt(routeDuration) || 0,
      };

      if (editing) {
        await apiFetch(`/routes/${editing.rid}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/routes", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setRouteModal(false);
      loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoute() {
    if (!deleteModal) return;
    try {
      await apiFetch(`/routes/${deleteModal.rid}`, { method: "DELETE" });
      setDeleteModal(null);
      loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  // ── Stops Management ──────────────────────────────────────────────────

  async function openStopsModal(route) {
    setStopsModal(route);
    setStopName("");
    setStopLat("");
    setStopLng("");
    setStopTime("");

    const coords = parseWKT(route.route_path);
    setBasePath(coords);

    try {
      const data = await apiFetch(`/stops?route_id=${route.rid}`);
      setCurrentStops(data.stops || []);
    } catch (err) {
      console.error("Load stops error:", err);
      setCurrentStops([]);
    }
  }

  function handleStopMapClick(latlng) {
    setStopLat(latlng.lat.toFixed(6));
    setStopLng(latlng.lng.toFixed(6));
  }

  async function handleAddStop() {
    if (!stopName || !stopLat || !stopLng) {
      alert("Enter name and click map for coordinates");
      return;
    }

    try {
      await apiFetch("/stops", {
        method: "POST",
        body: JSON.stringify({
          route_id: stopsModal.rid,
          name: stopName,
          latitude: parseFloat(stopLat),
          longitude: parseFloat(stopLng),
          sequence_number: currentStops.length + 1,
          scheduled_arrival_time: stopTime || null,
        }),
      });

      setStopName("");
      setStopLat("");
      setStopLng("");
      setStopTime("");

      const data = await apiFetch(`/stops?route_id=${stopsModal.rid}`);
      setCurrentStops(data.stops || []);
      loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to add stop");
    }
  }

  async function handleDeleteStop(stopId) {
    if (!confirm("Delete this stop?")) return;
    try {
      await apiFetch(`/stops/${stopId}`, { method: "DELETE" });
      const data = await apiFetch(`/stops?route_id=${stopsModal.rid}`);
      setCurrentStops(data.stops || []);
      loadRoutes();
    } catch (err) {
      alert(err.message || "Failed to delete stop");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Routes</h1>
          <p className="subtitle">Manage routes and stops</p>
        </div>
        <Button onClick={openAddRoute}>+ Add Route</Button>
      </div>

      <Card>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Distance</th>
                <th>Duration</th>
                <th>Stops</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    No routes found
                  </td>
                </tr>
              ) : (
                routes.map((route) => (
                  <tr key={route.rid}>
                    <td>
                      <div className="route-name-cell">
                        <span className="route-icon">📍</span>
                        <strong>{route.name}</strong>
                      </div>
                    </td>
                    <td>
                      {route.total_distance_km
                        ? `${route.total_distance_km} km`
                        : "-"}
                    </td>
                    <td>
                      {route.estimated_duration_min
                        ? `${route.estimated_duration_min} min`
                        : "-"}
                    </td>
                    <td>
                      <button
                        className="stops-badge"
                        onClick={() => openStopsModal(route)}
                      >
                        📍 {route.stop_count || 0} stops
                      </button>
                    </td>
                    <td>
                      <Badge variant={route.is_active ? "active" : "inactive"}>
                        {route.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditRoute(route)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteModal(route)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Route Create/Edit Modal */}
      <Modal
        isOpen={routeModal}
        onClose={() => setRouteModal(false)}
        title={editing ? "Edit Route" : "Add Route"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRouteModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSaveRoute}>
              Save Route
            </Button>
          </>
        }
      >
        <div className="route-modal-layout">
          <div className="route-form-panel">
            <FormGroup label="Route Name *">
              <FormInput
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. Kakinada to Surampalem"
              />
            </FormGroup>

            <FormRow>
              <FormGroup label="Distance (km)">
                <FormInput value={routeDistance} readOnly placeholder="Auto" />
              </FormGroup>
              <FormGroup label="Duration (min)">
                <FormInput value={routeDuration} readOnly placeholder="Auto" />
              </FormGroup>
            </FormRow>

            <div className="form-section-title">Path Selection</div>
            <p className="form-hint" style={{ marginBottom: "12px" }}>
              Click map to set Start then End point
            </p>

            <div className="point-selector">
              <div className="point-item">
                <span className="point-dot start" />
                <div>
                  <div className="point-label">Start</div>
                  <div className="point-coords">
                    {startPoint
                      ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}`
                      : "Click map"}
                  </div>
                </div>
              </div>
              <div className="point-item">
                <span className="point-dot end" />
                <div>
                  <div className="point-label">End</div>
                  <div className="point-coords">
                    {endPoint
                      ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}`
                      : "Click map"}
                  </div>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={resetPoints}
              className="reset-btn"
            >
              Reset Points
            </Button>
          </div>

          <div className="route-map-panel">
            <MapContainer
              center={[17.05, 82.15]}
              zoom={12}
              className="creation-map"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onClick={handleMapClick} />

              {startPoint && (
                <CircleMarker
                  center={startPoint}
                  radius={8}
                  color="#10b981"
                  fillColor="#10b981"
                  fillOpacity={1}
                >
                  <Popup>Start Point</Popup>
                </CircleMarker>
              )}

              {endPoint && (
                <CircleMarker
                  center={endPoint}
                  radius={8}
                  color="#ef4444"
                  fillColor="#ef4444"
                  fillOpacity={1}
                >
                  <Popup>End Point</Popup>
                </CircleMarker>
              )}

              {routePath.length > 1 && (
                <Polyline positions={routePath} color="#6366f1" weight={5} />
              )}
            </MapContainer>
          </div>
        </div>
      </Modal>

      {/* Stops Modal */}
      <Modal
        isOpen={!!stopsModal}
        onClose={() => setStopsModal(null)}
        title={`Stops - ${stopsModal?.name || ""}`}
        size="lg"
      >
        <div className="stops-layout">
          <div className="stops-list-panel">
            <div className="stops-list-header">
              <h4>Stops ({currentStops.length})</h4>
            </div>

            <div className="stops-list">
              {currentStops.length === 0 ? (
                <p
                  className="muted-text"
                  style={{ textAlign: "center", padding: "20px" }}
                >
                  No stops yet
                </p>
              ) : (
                currentStops
                  .sort((a, b) => a.sequence_number - b.sequence_number)
                  .map((stop) => (
                    <div key={stop.id} className="stop-item">
                      <div className="stop-order">{stop.sequence_number}</div>
                      <div className="stop-item-info">
                        <div className="stop-item-name">{stop.name}</div>
                        <div className="stop-item-coords">
                          {Number(stop.latitude).toFixed(4)},{" "}
                          {Number(stop.longitude).toFixed(4)}
                        </div>
                      </div>
                      <button
                        className="stop-delete-btn"
                        onClick={() => handleDeleteStop(stop.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="add-stop-form">
              <FormGroup label="Stop Name *">
                <FormInput
                  value={stopName}
                  onChange={(e) => setStopName(e.target.value)}
                  placeholder="e.g. Main Gate"
                />
              </FormGroup>
              <FormRow>
                <FormGroup label="Latitude *">
                  <FormInput
                    value={stopLat}
                    onChange={(e) => setStopLat(e.target.value)}
                    placeholder="Click map"
                  />
                </FormGroup>
                <FormGroup label="Longitude *">
                  <FormInput
                    value={stopLng}
                    onChange={(e) => setStopLng(e.target.value)}
                    placeholder="Click map"
                  />
                </FormGroup>
              </FormRow>
              <FormGroup label="Arrival Time">
                <FormInput
                  type="time"
                  value={stopTime}
                  onChange={(e) => setStopTime(e.target.value)}
                />
              </FormGroup>
              <Button size="sm" fullWidth onClick={handleAddStop}>
                + Add Stop
              </Button>
            </div>
          </div>

          <div className="stops-map-panel">
            <MapContainer
              center={[17.05, 82.15]}
              zoom={12}
              className="stops-map"
              key={stopsModal?.rid}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onClick={handleStopMapClick} />

              {/* Base route path */}
              {basePath.length > 1 && (
                <Polyline
                  positions={basePath}
                  color="#94a3b8"
                  weight={5}
                  opacity={0.4}
                />
              )}

              {/* Start/End dots */}
              {basePath.length > 1 && (
                <>
                  <CircleMarker
                    center={basePath[0]}
                    radius={6}
                    color="#10b981"
                    fillColor="#10b981"
                    fillOpacity={1}
                  >
                    <Popup>Route Start</Popup>
                  </CircleMarker>
                  <CircleMarker
                    center={basePath[basePath.length - 1]}
                    radius={6}
                    color="#ef4444"
                    fillColor="#ef4444"
                    fillOpacity={1}
                  >
                    <Popup>Route End</Popup>
                  </CircleMarker>
                </>
              )}

              {/* Stop markers */}
              {currentStops.map((stop) => (
                <CircleMarker
                  key={stop.id}
                  center={[stop.latitude, stop.longitude]}
                  radius={10}
                  color="#6366f1"
                  fillColor="#6366f1"
                  fillOpacity={1}
                  weight={2}
                >
                  <Popup>
                    {stop.sequence_number}. {stop.name}
                  </Popup>
                </CircleMarker>
              ))}

              {/* Dashed line connecting stops */}
              {currentStops.length > 1 && (
                <Polyline
                  positions={currentStops
                    .sort((a, b) => a.sequence_number - b.sequence_number)
                    .map((s) => [s.latitude, s.longitude])}
                  color="#6366f1"
                  weight={2}
                  dashArray="6 6"
                />
              )}
            </MapContainer>
            <p className="map-hint">Click map to set stop coordinates</p>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Route"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteRoute}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          Delete <strong>{deleteModal?.name}</strong>? All stops will be
          removed.
        </p>
      </Modal>
    </div>
  );
}
