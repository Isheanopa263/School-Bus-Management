const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/live-locations - Driver only
 */
router.post("/", requireAuth, requireRole(["driver"]), async (req, res) => {
  const { trip_id, latitude, longitude, speed_kmh, heading } = req.body;

  if (!trip_id || latitude === undefined || longitude === undefined) {
    return res
      .status(400)
      .json({ error: "trip_id, latitude, longitude required" });
  }

  try {
    const tripCheck = await db.query(
      `SELECT t.id, ra.bus_id FROM trips t
       JOIN route_assignments ra ON t.assignment_id = ra.id
       JOIN drivers d ON ra.driver_id = d.id
       WHERE t.id = $1 AND d.userid = $2 AND t.status = 'ongoing'`,
      [trip_id, req.user.userid],
    );

    if (tripCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No ongoing trip found or not authorized" });
    }

    const bus_id = tripCheck.rows[0].bus_id;

    // FIX 1: Use ::geometry not ::geography
    const { rows } = await db.query(
      `INSERT INTO live_locations (bus_id, trip_id, location, speed_kmh, heading, recorded_at)
       VALUES ($1, $2, ST_MakePoint($3, $4), $5, $6, NOW())
       RETURNING id, recorded_at`,
      [
        bus_id,
        trip_id,
        longitude,
        latitude,
        speed_kmh || null,
        heading || null,
      ],
    );

    // FIX 2: Same here for overspeeding event
    if (speed_kmh && speed_kmh > 60) {
      await db.query(
        `INSERT INTO trip_events (trip_id, bus_id, event_type, severity, location, details, occurred_at)
         VALUES ($1, $2, 'overspeeding', 'medium', ST_MakePoint($3, $4), $5, NOW())`,
        [
          trip_id,
          bus_id,
          longitude,
          latitude,
          JSON.stringify({ speed_kmh: speed_kmh }),
        ],
      );
    }

    res.status(201).json({ location: rows[0] });
  } catch (err) {
    console.error("GPS ingestion error:", err);
    res.status(500).json({ error: "Failed to record location" });
  }
});

/**
 * GET /api/live-locations/latest
 */
router.get("/latest", requireAuth, async (req, res) => {
  const { bus_id, trip_id } = req.query;

  if (!bus_id && !trip_id) {
    return res.status(400).json({ error: "bus_id or trip_id required" });
  }

  try {
    let query = `
      SELECT ll.id, ll.bus_id, ll.trip_id, ll.speed_kmh, ll.heading,
             ST_X(ll.location) as longitude,
             ST_Y(ll.location) as latitude,
             ll.recorded_at,
             b.registration_number, r.name as route_name
      FROM live_locations ll
      JOIN buses b ON ll.bus_id = b.bid
      LEFT JOIN trips t ON ll.trip_id = t.id
      LEFT JOIN route_assignments ra ON t.assignment_id = ra.id
      LEFT JOIN routes r ON ra.route_id = r.rid
      WHERE 1=1
    `;
    const params = [];

    if (bus_id) {
      params.push(bus_id);
      query += ` AND ll.bus_id = $${params.length}`;
    }
    if (trip_id) {
      params.push(trip_id);
      query += ` AND ll.trip_id = $${params.length}`;
    }

    query += ` ORDER BY ll.recorded_at DESC LIMIT 1`;

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No location data found" });
    }

    res.json({ location: rows[0] });
  } catch (err) {
    console.error("Get latest location error:", err);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

/**
 * GET /api/live-locations/trail/:trip_id
 */
router.get("/trail/:trip_id", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, speed_kmh, heading,
              ST_X(location) as longitude,
              ST_Y(location) as latitude,
              recorded_at
       FROM live_locations
       WHERE trip_id = $1
       ORDER BY recorded_at ASC`,
      [req.params.trip_id],
    );

    res.json({ trail: rows, count: rows.length });
  } catch (err) {
    console.error("Get trail error:", err);
    res.status(500).json({ error: "Failed to fetch trail" });
  }
});

module.exports = router;
