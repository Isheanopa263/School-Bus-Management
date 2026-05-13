const { createClient } = require("redis");

let client = null;
let redisAvailable = false;

// Only connect if REDIS_URL is set
if (process.env.REDIS_URL) {
  client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.warn("Redis: max retries reached, running without cache");
          redisAvailable = false;
          return false; // stop retrying
        }
        return retries * 500; // wait 500ms between retries
      },
    },
  });

  client.on("error", (err) => {
    console.warn("Redis unavailable - running without cache:", err.message);
    redisAvailable = false;
  });

  client.on("connect", () => {
    console.log("Redis connected");
    redisAvailable = true;
  });

  // Connect but don't crash if it fails
  client.connect().catch((err) => {
    console.warn(
      "Redis connection failed - running without cache:",
      err.message,
    );
    redisAvailable = false;
  });
} else {
  console.warn("REDIS_URL not set - running without cache");
}

// ── Helpers (all fail silently if Redis is down) ──────────────────────────────

async function cacheActiveTrip(trip_id, data) {
  if (!redisAvailable || !client) return;
  try {
    await client.setEx(`trip:${trip_id}`, 3600, JSON.stringify(data));
  } catch (err) {
    console.warn("Cache write failed:", err.message);
  }
}

async function getCachedTrip(trip_id) {
  if (!redisAvailable || !client) return null;
  try {
    const data = await client.get(`trip:${trip_id}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn("Cache read failed:", err.message);
    return null;
  }
}

async function invalidateTrip(trip_id) {
  if (!redisAvailable || !client) return;
  try {
    await client.del(`trip:${trip_id}`);
  } catch (err) {
    console.warn("Cache invalidate failed:", err.message);
  }
}

async function cacheLatestLocation(bus_id, locationData) {
  if (!redisAvailable || !client) return;
  try {
    await client.setEx(
      `bus_location:${bus_id}`,
      60,
      JSON.stringify(locationData),
    );
  } catch (err) {
    console.warn("Cache write failed:", err.message);
  }
}

async function getCachedLocation(bus_id) {
  if (!redisAvailable || !client) return null;
  try {
    const data = await client.get(`bus_location:${bus_id}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn("Cache read failed:", err.message);
    return null;
  }
}

async function publishLocation(bus_id, data) {
  if (!redisAvailable || !client) return;
  try {
    await client.publish(`location:${bus_id}`, JSON.stringify(data));
  } catch (err) {
    console.warn("Publish failed:", err.message);
  }
}

module.exports = {
  client,
  redisAvailable,
  cacheActiveTrip,
  getCachedTrip,
  invalidateTrip,
  cacheLatestLocation,
  getCachedLocation,
  publishLocation,
};
