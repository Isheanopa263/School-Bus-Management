const { createClient } = require("redis");

let client = null;
let redisAvailable = false;

if (process.env.REDIS_URL) {
  client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 2000, // connection attempt fails after 2s
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.warn("Redis: max retries reached, disabling cache");
          redisAvailable = false;
          return false; // stop reconnecting
        }
        return Math.min(retries * 100, 3000); // 100ms, 200ms, 300ms, max 3s
      },
    },
    // This is the key: don't queue commands when offline
    disableOfflineQueue: true,
    // Commands fail after 1s if no connection
    commandsQueueMaxLength: 1,
  });

  client.on("error", (err) => {
    // This fires on connection errors AND command errors
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      redisAvailable = false;
    }
  });

  client.on("connect", () => {
    console.log("Redis connected");
    redisAvailable = true;
  });

  client.on("ready", () => {
    redisAvailable = true;
  });

  client.on("end", () => {
    redisAvailable = false;
  });

  // Connect but don't block startup
  client.connect().catch((err) => {
    console.warn(
      "Redis connection failed - running without cache:",
      err.message,
    );
    redisAvailable = false;
  });
} else if (process.env.NODE_ENV !== "test") {
  console.warn("REDIS_URL not set - running without cache");
}

// ── Helpers: Add timeout to each command ──────────────────────────────

function withTimeout(promise, ms = 1000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis command timeout")), ms),
    ),
  ]);
}

async function cacheActiveTrip(trip_id, data) {
  if (!redisAvailable || !client) return;
  try {
    await withTimeout(
      client.setEx(`trip:${trip_id}`, 3600, JSON.stringify(data)),
      500,
    );
  } catch (err) {
    // Silently fail - either timeout or connection error
    redisAvailable = false;
  }
}

async function getCachedTrip(trip_id) {
  if (!redisAvailable || !client) return null;
  try {
    const data = await withTimeout(client.get(`trip:${trip_id}`), 500);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    redisAvailable = false;
    return null;
  }
}

async function invalidateTrip(trip_id) {
  if (!redisAvailable || !client) return;
  try {
    await withTimeout(client.del(`trip:${trip_id}`), 500);
  } catch (err) {
    redisAvailable = false;
  }
}

async function cacheLatestLocation(bus_id, locationData) {
  if (!redisAvailable || !client) return;
  try {
    await withTimeout(
      client.setEx(`bus_location:${bus_id}`, 60, JSON.stringify(locationData)),
      500,
    );
  } catch (err) {
    redisAvailable = false;
  }
}

async function getCachedLocation(bus_id) {
  if (!redisAvailable || !client) return null;
  try {
    const data = await withTimeout(client.get(`bus_location:${bus_id}`), 500);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    redisAvailable = false;
    return null;
  }
}

async function publishLocation(bus_id, data) {
  if (!redisAvailable || !client) return;
  try {
    await withTimeout(
      client.publish(`location:${bus_id}`, JSON.stringify(data)),
      500,
    );
  } catch (err) {
    redisAvailable = false;
  }
}

async function quit() {
  if (client) {
    try {
      await client.quit();
    } catch {
      try {
        await client.disconnect();
      } catch {}
    }
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
  quit,
};
