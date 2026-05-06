const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/routes - Admin only
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { name, route_path, total_distance_km, estimated_duration_min } =
    req.body;

  if (!name) {
    return res.status(400).json({ error: "Route name required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO routes (name, route_path, total_distance_km, estimated_duration_min)
       VALUES ($1, ST_GeomFromText($2, 4326), $3, $4)
       RETURNING rid, name, ST_AsText(route_path) as route_path, total_distance_km, estimated_duration_min, is_active`,
      [name, route_path, total_distance_km, estimated_duration_min],
    );
    res.status(201).json({ route: rows[0] });
  } catch (err) {
    console.error("Create route error:", err);
    res.status(500).json({ error: "Failed to create route" });
  }
});

/**
 * GET /api/routes - All authenticated
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT rid, name, ST_AsText(route_path) as route_path,
             total_distance_km, estimated_duration_min, is_active
      FROM routes
      WHERE is_active = true
      ORDER BY name
    `);
    res.json({ routes: rows });
  } catch (err) {
    console.error("Get routes error:", err);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

module.exports = router;
