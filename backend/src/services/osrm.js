/**
 * OSRM Service
 * Road-based distance and ETA calculation using public OSRM API
 */

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/**
 * Get road-based route between two points
 * @param {number} fromLat
 * @param {number} fromLng
 * @param {number} toLat
 * @param {number} toLng
 * @returns {{ distance_m, duration_min, geometry }} or null
 */
async function getRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.warn("[OSRM] HTTP error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("[OSRM] No route found:", data.code);
      return null;
    }

    const route = data.routes[0];

    return {
      distance_m: Math.round(route.distance),
      duration_min: Math.round(route.duration / 60),
      geometry: route.geometry,
    };
  } catch (err) {
    console.warn("[OSRM] Request failed:", err.message);
    return null;
  }
}

/**
 * Get ETA from bus current position to a stop
 * Falls back to straight-line distance if OSRM fails
 * @param {number} busLat
 * @param {number} busLng
 * @param {number} stopLat
 * @param {number} stopLng
 * @param {number} speedKmh - current bus speed (for fallback)
 */
async function getETA(busLat, busLng, stopLat, stopLng, speedKmh = 30) {
  // Try OSRM first
  const route = await getRoute(busLat, busLng, stopLat, stopLng);

  if (route) {
    return {
      distance_m: route.distance_m,
      duration_min: route.duration_min,
      method: "osrm",
    };
  }

  // Fallback: Haversine straight-line distance
  const dist = haversineDistance(busLat, busLng, stopLat, stopLng);
  const speed = speedKmh > 5 ? speedKmh : 30;
  const durationMin = Math.round((dist / 1000 / speed) * 60);

  return {
    distance_m: Math.round(dist),
    duration_min: durationMin,
    method: "straight-line",
  };
}

/**
 * Haversine distance in meters between two lat/lng points
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = { getRoute, getETA, haversineDistance };
