const db = require("../../src/db");

async function cleanDatabase() {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Clear in correct FK order
    await client.query("DELETE FROM trip_stop_visits");
    await client.query("DELETE FROM student_attendance");
    await client.query("DELETE FROM live_locations");
    await client.query("DELETE FROM trip_events");
    await client.query("DELETE FROM notifications");
    await client.query("DELETE FROM bus_requests");
    await client.query("DELETE FROM complaints");
    await client.query("DELETE FROM trips");
    await client.query("DELETE FROM route_assignments");

    // Unassign students from stops BEFORE deleting stops
    await client.query("UPDATE students SET assigned_stop_id = NULL");

    await client.query("DELETE FROM stops");
    await client.query("DELETE FROM students");
    await client.query("DELETE FROM drivers");
    await client.query("DELETE FROM routes");
    await client.query("DELETE FROM buses");
    await client.query("DELETE FROM users");

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
async function createTestBus(overrides = {}) {
  const data = {
    registration_number: `BUS-${Date.now()}`,
    capacity: 50,
    model: "Test Bus",
    status: "active",
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO buses (registration_number, capacity, model, status)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.registration_number, data.capacity, data.model, data.status],
  );
  return rows[0];
}

async function createTestRoute(overrides = {}) {
  const data = {
    name: `Route-${Date.now()}`,
    total_distance_km: 25,
    estimated_duration_min: 45,
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO routes (name, total_distance_km, estimated_duration_min)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.total_distance_km, data.estimated_duration_min],
  );
  return rows[0];
}

async function createTestStop(routeId, sequence = 1, overrides = {}) {
  const data = {
    name: `Stop-${sequence}`,
    latitude: 17.0 + sequence * 0.01,
    longitude: 82.2 + sequence * 0.01,
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO stops (route_id, name, location, sequence_number)
     VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
     RETURNING id, route_id, name, sequence_number,
               ST_Y(location::geometry) as latitude,
               ST_X(location::geometry) as longitude`,
    [routeId, data.name, data.longitude, data.latitude, sequence],
  );
  return rows[0];
}

async function createTestAssignment(routeId, busId, driverId, overrides = {}) {
  const data = {
    effective_date: new Date().toISOString().split("T")[0],
    shift: "morning",
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO route_assignments (route_id, bus_id, driver_id, effective_date, shift)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [routeId, busId, driverId, data.effective_date, data.shift],
  );
  return rows[0];
}

async function createTestTrip(assignmentId, overrides = {}) {
  const data = {
    trip_date: new Date().toISOString().split("T")[0],
    trip_type: "pickup",
    status: "ongoing",
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO trips (assignment_id, trip_date, trip_type, status, start_time)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [assignmentId, data.trip_date, data.trip_type, data.status],
  );
  return rows[0];
}

async function closePool() {
  await db.pool.end();
}

module.exports = {
  cleanDatabase,
  createTestBus,
  createTestRoute,
  createTestStop,
  createTestAssignment,
  createTestTrip,
  closePool,
};
