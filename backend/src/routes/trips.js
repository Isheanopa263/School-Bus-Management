const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/trips - List trips
 * Admin: all trips
 * Driver: only assigned trips
 * Student: only trips for their route
 */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "driver", "student"]),
  async (req, res) => {
    const { status, date, route_id } = req.query;

    try {
      let query = `
      SELECT t.*,
             ra.shift, ra.effective_date,
             r.name as route_name, r.rid as route_id,
             b.registration_number as bus_number, b.bid as bus_id,
             d.id as driver_id, u.full_name as driver_name
      FROM trips t
      JOIN route_assignments ra ON t.assignment_id = ra.id
      JOIN routes r ON ra.route_id = r.rid
      JOIN buses b ON ra.bus_id = b.bid
      JOIN drivers d ON ra.driver_id = d.id
      JOIN users u ON d.userid = u.userid
    `;
      const params = [];
      const conditions = [];

      // Role-based filtering
      if (req.user.role === "driver") {
        conditions.push(`d.userid = $${params.length + 1}`);
        params.push(req.user.userid);
      } else if (req.user.role === "student") {
        query += ` JOIN students s ON s.userid = $${params.length + 1}
                 JOIN stops st ON s.assigned_stop_id = st.id
                 WHERE st.route_id = r.rid`;
        params.push(req.user.userid);
      }

      // Filters
      if (status) {
        conditions.push(`t.status = $${params.length + 1}`);
        params.push(status);
      }
      if (date) {
        conditions.push(`t.trip_date = $${params.length + 1}`);
        params.push(date);
      }
      if (route_id) {
        conditions.push(`r.rid = $${params.length + 1}`);
        params.push(route_id);
      }

      if (conditions.length > 0 && req.user.role !== "student") {
        query += " WHERE " + conditions.join(" AND ");
      } else if (conditions.length > 0) {
        query += " AND " + conditions.join(" AND ");
      }

      query += " ORDER BY t.trip_date DESC, t.start_time DESC";

      const { rows } = await db.query(query, params);
      res.json({ trips: rows });
    } catch (err) {
      console.error("Get trips error:", err);
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  },
);

/**
 * GET /api/trips/:id - Get single trip with events
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const tripResult = await db.query(
      `SELECT t.*,
              ra.shift, ra.effective_date,
              r.name as route_name, r.rid as route_id,
              b.registration_number as bus_number, b.bid as bus_id,
              d.id as driver_id, u.full_name as driver_name
       FROM trips t
       JOIN route_assignments ra ON t.assignment_id = ra.id
       JOIN routes r ON ra.route_id = r.rid
       JOIN buses b ON ra.bus_id = b.bid
       JOIN drivers d ON ra.driver_id = d.id
       JOIN users u ON d.userid = u.userid
       WHERE t.id = $1`,
      [req.params.id],
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    // Get trip events
    const eventsResult = await db.query(
      `SELECT * FROM trip_events WHERE trip_id = $1 ORDER BY occurred_at DESC`,
      [req.params.id],
    );

    res.json({
      trip: tripResult.rows[0],
      events: eventsResult.rows,
    });
  } catch (err) {
    console.error("Get trip error:", err);
    res.status(500).json({ error: "Failed to fetch trip" });
  }
});

/**
 * POST /api/trips/start - Driver only
 * Start a new trip for assigned route
 */
router.post(
  "/start",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const { assignment_id, trip_type } = req.body; // trip_type: 'pickup' or 'drop'

    if (!assignment_id || !trip_type) {
      return res
        .status(400)
        .json({ error: "assignment_id and trip_type required" });
    }

    if (!["pickup", "drop"].includes(trip_type)) {
      return res
        .status(400)
        .json({ error: "trip_type must be pickup or drop" });
    }

    try {
      // 1. Verify driver owns this assignment
      const assignmentResult = await db.query(
        `SELECT ra.*, d.userid FROM route_assignments ra
       JOIN drivers d ON ra.driver_id = d.id
       WHERE ra.id = $1 AND d.userid = $2`,
        [assignment_id, req.user.userid],
      );

      if (assignmentResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Not authorized for this assignment" });
      }

      // 2. Check if there's already an ongoing trip
      const ongoingResult = await db.query(
        `SELECT id FROM trips WHERE assignment_id = $1 AND status = 'ongoing'`,
        [assignment_id],
      );

      if (ongoingResult.rows.length > 0) {
        return res
          .status(409)
          .json({ error: "Trip already ongoing for this assignment" });
      }

      // 3. Create trip
      const { rows } = await db.query(
        `INSERT INTO trips (assignment_id, trip_date, trip_type, start_time, status)
       VALUES ($1, CURRENT_DATE, $2, NOW(), 'ongoing')
       RETURNING *`,
        [assignment_id, trip_type],
      );

      res.status(201).json({ trip: rows[0], message: "Trip started" });
    } catch (err) {
      console.error("Start trip error:", err);
      res.status(500).json({ error: "Failed to start trip" });
    }
  },
);

/**
 * PUT /api/trips/:id/end - Driver only
 * End an ongoing trip
 */
router.put(
  "/:id/end",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const { id } = req.params;
    const { delay_minutes } = req.body;

    try {
      // 1. Verify driver owns this trip
      const tripResult = await db.query(
        `SELECT t.*, d.userid FROM trips t
       JOIN route_assignments ra ON t.assignment_id = ra.id
       JOIN drivers d ON ra.driver_id = d.id
       WHERE t.id = $1 AND t.status = 'ongoing'`,
        [id],
      );

      if (tripResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Ongoing trip not found or not authorized" });
      }

      // 2. End trip
      const { rows } = await db.query(
        `UPDATE trips
       SET end_time = NOW(), status = 'completed', delay_minutes = COALESCE($1, 0)
       WHERE id = $2
       RETURNING *`,
        [delay_minutes || 0, id],
      );

      res.json({ trip: rows[0], message: "Trip ended" });
    } catch (err) {
      console.error("End trip error:", err);
      res.status(500).json({ error: "Failed to end trip" });
    }
  },
);

/**
 * POST /api/trips/:id/event - Driver or system
 * Log trip event: overspeeding, breakdown, route_deviation
 */
router.post(
  "/:id/event",
  requireAuth,
  requireRole(["driver", "admin"]),
  async (req, res) => {
    const { id } = req.params;
    const { event_type, severity, location, details } = req.body;

    if (!event_type || !severity) {
      return res
        .status(400)
        .json({ error: "event_type and severity required" });
    }

    try {
      // Verify trip exists and is ongoing
      const tripResult = await db.query(
        "SELECT bus_id FROM trips t JOIN route_assignments ra ON t.assignment_id = ra.id WHERE t.id = $1",
        [id],
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const { rows } = await db.query(
        `INSERT INTO trip_events (trip_id, bus_id, event_type, severity, location, details, occurred_at)
       VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326), $6, NOW())
       RETURNING *`,
        [
          id,
          tripResult.rows[0].bus_id,
          event_type,
          severity,
          location,
          JSON.stringify(details || {}),
        ],
      );

      res.status(201).json({ event: rows[0] });
    } catch (err) {
      console.error("Create trip event error:", err);
      res.status(500).json({ error: "Failed to log event" });
    }
  },
);

module.exports = router;
