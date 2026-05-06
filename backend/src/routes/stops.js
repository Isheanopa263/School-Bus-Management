const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/stops - Admin only
 * location format: 'POINT(77.5946 12.9716)' - lng lat
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { route_id, name, location, sequence_number, scheduled_arrival_time } =
    req.body;

  if (!route_id || !name || !location || !sequence_number) {
    return res
      .status(400)
      .json({ error: "route_id, name, location, sequence_number required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO stops (route_id, name, location, sequence_number, scheduled_arrival_time)
       VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5)
       RETURNING id, route_id, name, ST_AsText(location) as location, sequence_number, scheduled_arrival_time`,
      [route_id, name, location, sequence_number, scheduled_arrival_time],
    );
    res.status(201).json({ stop: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Sequence number already exists for this route" });
    }
    console.error("Create stop error:", err);
    res.status(500).json({ error: "Failed to create stop" });
  }
});

/**
 * GET /api/stops?route_id=xxx - All authenticated
 */
router.get("/", requireAuth, async (req, res) => {
  const { route_id } = req.query;

  try {
    let query = `
      SELECT s.id, s.route_id, s.name, ST_AsText(s.location) as location,
             s.sequence_number, s.scheduled_arrival_time, r.name as route_name
      FROM stops s
      JOIN routes r ON s.route_id = r.rid
    `;
    const params = [];

    if (route_id) {
      query += " WHERE s.route_id = $1";
      params.push(route_id);
    }

    query += " ORDER BY s.route_id, s.sequence_number";

    const { rows } = await db.query(query, params);
    res.json({ stops: rows });
  } catch (err) {
    console.error("Get stops error:", err);
    res.status(500).json({ error: "Failed to fetch stops" });
  }
});

/**
 * DELETE /api/stops/:id - Admin only
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM stops WHERE id = $1", [
      req.params.id,
    ]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Stop not found" });
    }
    res.json({ message: "Stop deleted" });
  } catch (err) {
    console.error("Delete stop error:", err);
    res.status(500).json({ error: "Failed to delete stop" });
  }
});

module.exports = router;
