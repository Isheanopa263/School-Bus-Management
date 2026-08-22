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

/**
 * DELETE /api/route-assignments/:id - Admin only
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Check if assignment has trips
    const tripCheck = await client.query(
      "SELECT COUNT(*) FROM trips WHERE assignment_id = $1",
      [req.params.id],
    );

    const tripCount = parseInt(tripCheck.rows[0].count);

    if (tripCount > 0) {
      // Nullify assignment_id on trips instead of blocking delete
      await client.query(
        "UPDATE trips SET assignment_id = NULL WHERE assignment_id = $1",
        [req.params.id],
      );
    }

    // Now safe to delete
    const { rowCount } = await client.query(
      "DELETE FROM route_assignments WHERE id = $1",
      [req.params.id],
    );

    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Assignment not found" });
    }

    await client.query("COMMIT");
    res.json({
      message: "Assignment deleted",
      trips_unlinked: tripCount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete assignment error:", err);
    res.status(500).json({ error: "Failed to delete assignment" });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/route-assignments/:id/toggle-pause
 * Pause or resume an assignment

router.put(
  "/:id/toggle-pause",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        `UPDATE route_assignments
         SET is_paused = NOT COALESCE(is_paused, false)
         WHERE id = $1
         RETURNING id, is_paused`,
        [req.params.id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      res.json({
        assignment: rows[0],
        message: rows[0].is_paused ? "Assignment paused" : "Assignment resumed",
      });
    } catch (err) {
      console.error("Toggle pause error:", err);
      res.status(500).json({ error: "Failed to toggle pause" });
    }
  },
);
 */
/**
 * PUT /api/route-assignments/:id - Admin only
 * Edit an assignment
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { route_id, bus_id, driver_id, effective_date, end_date, shift } =
    req.body;

  if (!route_id || !bus_id || !driver_id || !effective_date || !shift) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE route_assignments
         SET route_id       = $1,
             bus_id         = $2,
             driver_id      = $3,
             effective_date = $4,
             end_date       = $5,
             shift          = $6
         WHERE id = $7
         RETURNING *`,
      [
        route_id,
        bus_id,
        driver_id,
        effective_date,
        end_date || null,
        shift,
        id,
      ],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({ assignment: rows[0], message: "Assignment updated" });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Bus or driver already assigned for this date/shift" });
    }
    console.error("Update assignment error:", err);
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

module.exports = router;
