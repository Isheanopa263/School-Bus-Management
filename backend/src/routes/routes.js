const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/routes
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { name, route_path, total_distance_km, estimated_duration_min } =
    req.body;

  if (!name) return res.status(400).json({ error: "Route name required" });

  try {
    const { rows } = await db.query(
      `INSERT INTO routes (name, route_path, total_distance_km, estimated_duration_min)
       VALUES ($1, $2, $3, $4)
       RETURNING rid, name, ST_AsText(route_path) as route_path, total_distance_km, estimated_duration_min, is_active`,
      [
        name,
        route_path || null,
        total_distance_km || null,
        estimated_duration_min || null,
      ],
    );
    res.status(201).json({ route: rows[0] });
  } catch (err) {
    console.error("Create route error:", err);
    res.status(500).json({ error: "Failed to create route" });
  }
});

/**
 * GET /api/routes
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.rid, r.name, ST_AsText(r.route_path) as route_path,
             r.total_distance_km, r.estimated_duration_min, r.is_active,
             (SELECT COUNT(*) FROM stops WHERE route_id = r.rid)::int as stop_count
      FROM routes r
      WHERE r.is_active = true
      ORDER BY r.name
    `);
    res.json({ routes: rows });
  } catch (err) {
    console.error("Get routes error:", err);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

/**
 * PUT /api/routes/:id
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { name, route_path, total_distance_km, estimated_duration_min } =
    req.body;

  if (!name) return res.status(400).json({ error: "Route name required" });

  try {
    let query, params;

    if (route_path) {
      query = `UPDATE routes SET name=$1, route_path=ST_GeomFromText($2, 4326), total_distance_km=$3, estimated_duration_min=$4 WHERE rid=$5
               RETURNING rid, name, ST_AsText(route_path) as route_path, total_distance_km, estimated_duration_min, is_active`;
      params = [
        name,
        route_path,
        total_distance_km,
        estimated_duration_min,
        id,
      ];
    } else {
      query = `UPDATE routes SET name=$1, total_distance_km=$2, estimated_duration_min=$3 WHERE rid=$4
               RETURNING rid, name, ST_AsText(route_path) as route_path, total_distance_km, estimated_duration_min, is_active`;
      params = [name, total_distance_km, estimated_duration_min, id];
    }

    const { rows } = await db.query(query, params);
    if (rows.length === 0)
      return res.status(404).json({ error: "Route not found" });
    res.json({ route: rows[0] });
  } catch (err) {
    console.error("Update route error:", err);
    res.status(500).json({ error: "Failed to update route" });
  }
});

/**
 * DELETE /api/routes/:id
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { rowCount } = await db.query(
      "UPDATE routes SET is_active=false WHERE rid=$1",
      [req.params.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Route not found" });
    res.json({ message: "Route deleted" });
  } catch (err) {
    console.error("Delete route error:", err);
    res.status(500).json({ error: "Failed to delete route" });
  }
});

module.exports = router;
