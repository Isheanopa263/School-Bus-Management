const { createClient } = require("redis");

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on("error", (err) => console.error("Redis Client Error", err));
client.on("connect", () => console.log("Redis connected"));

(async () => {
  await client.connect();
})();

// Helper: Cache active trip data
async function cacheActiveTrip(trip_id, data) {
  await client.setEx(`trip:${trip_id}`, 3600, JSON.stringify(data)); // 1hr TTL
}

// Helper: Get cached trip
async function getCachedTrip(trip_id) {
  const data = await client.get(`trip:${trip_id}`);
  return data ? JSON.parse(data) : null;
}

// Helper: Invalidate trip cache
async function invalidateTrip(trip_id) {
  await client.del(`trip:${trip_id}`);
}

// Helper: Cache latest location for fast polling
async function cacheLatestLocation(bus_id, locationData) {
  await client.setEx(
    `bus_location:${bus_id}`,
    60,
    JSON.stringify(locationData),
  ); // 60s TTL
}

async function getCachedLocation(bus_id) {
  const data = await client.get(`bus_location:${bus_id}`);
  return data ? JSON.parse(data) : null;
}

// Pub/Sub for real-time
async function publishLocation(bus_id, data) {
  await client.publish(`location:${bus_id}`, JSON.stringify(data));
}

module.exports = {
  client,
  cacheActiveTrip,
  getCachedTrip,
  invalidateTrip,
  cacheLatestLocation,
  getCachedLocation,
  publishLocation,
};
