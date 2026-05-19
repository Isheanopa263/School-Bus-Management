/**
 * Geofence Service
 * Detects when a bus arrives at a stop and triggers notifications
 */

const db = require("../db");
const { haversineDistance } = require("./osrm");

const STOP_ARRIVAL_RADIUS_M = 100; // 100 meter radius

/**
 * Check if bus has arrived at any unvisited stop
 * Called on every GPS location update during active trip
 *
 * @param {string} tripId
 * @param {string} busId
 * @param {number} busLat
 * @param {number} busLng
 */
async function checkGeofence(tripId, busId, busLat, busLng) {
  try {
    // 1. Get all stops for this trip's route
    //    that have NOT been visited yet
    const { rows: unvisitedStops } = await db.query(
      `SELECT 
        s.id,
        s.name,
        s.sequence_number,
        ST_Y(s.location::geometry) AS latitude,
        ST_X(s.location::geometry) AS longitude
       FROM stops s
       JOIN routes r ON s.route_id = r.rid
       JOIN route_assignments ra ON ra.route_id = r.rid
       JOIN trips t ON t.assignment_id = ra.id
       WHERE t.id = $1
         AND s.id NOT IN (
           SELECT stop_id FROM trip_stop_visits WHERE trip_id = $1
         )
       ORDER BY s.sequence_number ASC`,
      [tripId],
    );

    if (unvisitedStops.length === 0) {
      console.log(`[GEOFENCE] All stops visited for trip ${tripId}`);
      return null;
    }

    // 2. Check distance to NEXT unvisited stop only
    const nextStop = unvisitedStops[0];
    const distance = haversineDistance(
      busLat,
      busLng,
      parseFloat(nextStop.latitude),
      parseFloat(nextStop.longitude),
    );

    console.log(
      `[GEOFENCE] Bus → Stop "${nextStop.name}": ${Math.round(distance)}m ` +
        `(threshold: ${STOP_ARRIVAL_RADIUS_M}m)`,
    );

    if (distance <= STOP_ARRIVAL_RADIUS_M) {
      // 3. Bus has arrived at this stop
      console.log(`[GEOFENCE] ✅ Arrived at stop: ${nextStop.name}`);
      await handleStopArrival(tripId, busId, nextStop);
      return nextStop;
    }

    return null;
  } catch (err) {
    console.error("[GEOFENCE] Error:", err.message);
    return null;
  }
}

/**
 * Handle bus arrival at a stop:
 * 1. Record visit in trip_stop_visits
 * 2. Find students at this stop
 * 3. Create notifications for them
 */
async function handleStopArrival(tripId, busId, stop) {
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Record stop visit (INSERT IGNORE if already exists)
    const visitResult = await client.query(
      `INSERT INTO trip_stop_visits (trip_id, stop_id)
       VALUES ($1, $2)
       ON CONFLICT (trip_id, stop_id) DO NOTHING
       RETURNING id`,
      [tripId, stop.id],
    );

    // Already visited - skip
    if (visitResult.rows.length === 0) {
      await client.query("ROLLBACK");
      console.log(`[GEOFENCE] Stop ${stop.name} already recorded`);
      return;
    }

    // 2. Get students assigned to this stop
    const { rows: students } = await client.query(
      `SELECT s.sid, u.userid, u.full_name, u.fcm_token
       FROM students s
       JOIN users u ON s.userid = u.userid
       WHERE s.assigned_stop_id = $1
         AND s.bus_request_status = 'approved'`,
      [stop.id],
    );

    console.log(
      `[GEOFENCE] Notifying ${students.length} students at ${stop.name}`,
    );

    // 3. Create notifications for each student
    for (const student of students) {
      await client.query(
        `INSERT INTO notifications (user_id, trip_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          student.userid,
          tripId,
          "bus_arriving",
          "🚌 Bus Arriving",
          `Your bus is arriving at ${stop.name}. Please be ready!`,
        ],
      );

      // Send FCM push notification if token exists
      if (student.fcm_token) {
        try {
          const { sendToToken } = require("./fcm");
          await sendToToken(
            student.fcm_token,
            "🚌 Bus Arriving",
            `Your bus is arriving at ${stop.name}. Please be ready!`,
            { type: "bus_arriving", stop_id: stop.id, trip_id: tripId },
          );
        } catch (fcmErr) {
          console.warn("[GEOFENCE] FCM send failed:", fcmErr.message);
        }
      }
    }

    // 4. Update visit record with student count
    await client.query(
      `UPDATE trip_stop_visits
       SET notified_students_count = $1
       WHERE trip_id = $2 AND stop_id = $3`,
      [students.length, tripId, stop.id],
    );

    await client.query("COMMIT");

    console.log(
      `[GEOFENCE] ✅ Stop visit recorded. ` +
        `Notified ${students.length} students.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[GEOFENCE] handleStopArrival error:", err.message);
  } finally {
    client.release();
  }
}

/**
 * Get next unvisited stop for a trip
 */
async function getNextStop(tripId) {
  try {
    const { rows } = await db.query(
      `SELECT 
        s.id,
        s.name,
        s.sequence_number,
        s.scheduled_arrival_time,
        ST_Y(s.location::geometry) AS latitude,
        ST_X(s.location::geometry) AS longitude
       FROM stops s
       JOIN routes r ON s.route_id = r.rid
       JOIN route_assignments ra ON ra.route_id = r.rid
       JOIN trips t ON t.assignment_id = ra.id
       WHERE t.id = $1
         AND s.id NOT IN (
           SELECT stop_id FROM trip_stop_visits WHERE trip_id = $1
         )
       ORDER BY s.sequence_number ASC
       LIMIT 1`,
      [tripId],
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error("[GEOFENCE] getNextStop error:", err.message);
    return null;
  }
}

/**
 * Get all visited stops for a trip
 */
async function getVisitedStops(tripId) {
  try {
    const { rows } = await db.query(
      `SELECT 
        tsv.stop_id,
        tsv.arrived_at,
        tsv.notified_students_count,
        s.name,
        s.sequence_number
       FROM trip_stop_visits tsv
       JOIN stops s ON tsv.stop_id = s.id
       WHERE tsv.trip_id = $1
       ORDER BY s.sequence_number ASC`,
      [tripId],
    );
    return rows;
  } catch (err) {
    console.error("[GEOFENCE] getVisitedStops error:", err.message);
    return [];
  }
}

module.exports = {
  checkGeofence,
  getNextStop,
  getVisitedStops,
  STOP_ARRIVAL_RADIUS_M,
};
