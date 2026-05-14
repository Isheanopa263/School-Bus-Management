const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/stops
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const {
    route_id,
    name,
    latitude,
    longitude,
    sequence_number,
    scheduled_arrival_time,
  } = req.body;

  if (
    !route_id ||
    !name ||
    latitude === undefined ||
    longitude === undefined ||
    !sequence_number
  ) {
    return res
      .status(400)
      .json({
        error: "route_id, name, latitude, longitude, sequence_number required",
      });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO stops (route_id, name, location, sequence_number, scheduled_arrival_time)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6)
       RETURNING id, route_id, name,
                 ST_Y(location::geometry) as latitude,
                 ST_X(location::geometry) as longitude,
                 sequence_number, scheduled_arrival_time`,
      [
        route_id,
        name,
        parseFloat(longitude),
        parseFloat(latitude),
        sequence_number,
        scheduled_arrival_time || null,
      ],
    );
    res.status(201).json({ stop: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Sequence number already exists for this route" });
    console.error("Create stop error:", err);
    res.status(500).json({ error: "Failed to create stop" });
  }
});

/**
 * GET /api/stops?route_id=xxx
 */
router.get("/", requireAuth, async (req, res) => {
  const { route_id } = req.query;
  if (!route_id)
    return res.status(400).json({ error: "route_id query param required" });

  try {
    const { rows } = await db.query(
      `SELECT id, route_id, name,
              ST_Y(location::geometry) as latitude,
              ST_X(location::geometry) as longitude,
              sequence_number, scheduled_arrival_time
       FROM stops
       WHERE route_id = $1
       ORDER BY sequence_number`,
      [route_id],
    );
    res.json({ stops: rows });
  } catch (err) {
    console.error("Get stops error:", err);
    res.status(500).json({ error: "Failed to fetch stops" });
  }
});

/**
 * DELETE /api/stops/:id
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE students SET assigned_stop_id=NULL WHERE assigned_stop_id=$1",
      [req.params.id],
    );
    const { rowCount } = await client.query("DELETE FROM stops WHERE id=$1", [
      req.params.id,
    ]);
    await client.query("COMMIT");
    if (rowCount === 0)
      return res.status(404).json({ error: "Stop not found" });
    res.json({ message: "Stop deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete stop error:", err);
    res.status(500).json({ error: "Failed to delete stop" });
  } finally {
    client.release();
  }
});

module.exports = router;
