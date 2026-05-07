const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/route-assignments - Admin only
 * Assign bus + driver to route for specific date/shift
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { route_id, bus_id, driver_id, effective_date, end_date, shift } =
    req.body;

  if (!route_id || !bus_id || !driver_id || !effective_date || !shift) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO route_assignments (route_id, bus_id, driver_id, effective_date, end_date, shift)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [route_id, bus_id, driver_id, effective_date, end_date, shift],
    );
    res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Bus or driver already assigned for this date/shift" });
    }
    console.error("Create assignment error:", err);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

/**
 * GET /api/route-assignments - Admin, Driver
 * Drivers see only their assignments
 */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "driver"]),
  async (req, res) => {
    try {
      let query = `
      SELECT ra.*,
             r.name as route_name,
             b.registration_number as bus_number,
             u.full_name as driver_name,
             d.id as driver_table_id
      FROM route_assignments ra
      JOIN routes r ON ra.route_id = r.rid
      JOIN buses b ON ra.bus_id = b.bid
      JOIN drivers d ON ra.driver_id = d.id
      JOIN users u ON d.userid = u.userid
    `;
      const params = [];

      // Driver sees only own assignments
      if (req.user.role === "driver") {
        query += " WHERE d.userid = $1";
        params.push(req.user.userid);
      }

      query += " ORDER BY ra.effective_date DESC, ra.shift";

      const { rows } = await db.query(query, params);
      res.json({ assignments: rows });
    } catch (err) {
      console.error("Get assignments error:", err);
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  },
);

module.exports = router;
