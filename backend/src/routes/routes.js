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

/**
 * PUT /api/routes/:id - Update route
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { name, route_path, total_distance_km, estimated_duration_min } =
    req.body;

  if (!name) {
    return res.status(400).json({ error: "Route name required" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE routes
       SET name = $1,
           route_path = ST_GeomFromText($2, 4326),
           total_distance_km = $3,
           estimated_duration_min = $4
       WHERE rid = $5
       RETURNING rid, name, ST_AsText(route_path) as route_path,
                 total_distance_km, estimated_duration_min, is_active`,
      [name, route_path, total_distance_km, estimated_duration_min, id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }
    res.json({ route: rows[0] });
  } catch (err) {
    console.error("Update route error:", err);
    res.status(500).json({ error: "Failed to update route" });
  }
});

/**
 * DELETE /api/routes/:id - Soft delete route
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      "UPDATE routes SET is_active = false WHERE rid = $1",
      [id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Route not found" });
    }
    res.status(204).send(); // No content
  } catch (err) {
    console.error("Delete route error:", err);
    res.status(500).json({ error: "Failed to delete route" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rid, name FROM routes WHERE is_active = true`,
    );
    res.json({ routes: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
