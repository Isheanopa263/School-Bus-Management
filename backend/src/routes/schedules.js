const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

async function checkConflict(
  bus_id,
  driver_id,
  day_of_week,
  start_time,
  end_time,
  exclude_sid = null,
) {
  let query = `
    SELECT id, bus_id, driver_id, start_time, end_time
    FROM schedules
    WHERE day_of_week = $1
      AND is_active = true
      AND (
        (bus_id = $2) OR (driver_id = $3)
      )
      AND (
        (start_time, end_time) OVERLAPS ($4::time, $5::time)
      )
  `;
  const params = [day_of_week, bus_id, driver_id, start_time, end_time];

  if (exclude_sid) {
    query += ` AND id != $6`;
    params.push(exclude_sid);
  }

  const result = await db.query(query, params);
  return result.rows;
}

// GET all schedules
router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        s.*,
        b.registration_number as bus_registration,
        r.name as route_name,
        u.full_name as driver_name
      FROM schedules s
      LEFT JOIN buses b ON s.bus_id = b.bid
      LEFT JOIN routes r ON s.route_id = r.rid
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN users u ON d.userid = u.userid
      WHERE s.is_active = true
      ORDER BY s.day_of_week, s.start_time
    `);
    res.json({ schedules: result.rows });
  } catch (err) {
    console.error("Get schedules error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Check conflicts
router.post(
  "/check-conflict",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { bus_id, driver_id, day_of_week, start_time, end_time, exclude_id } =
      req.body;
    try {
      const busConflict = await db.query(
        `
      SELECT id FROM schedules
      WHERE bus_id = $1 AND day_of_week = $2 AND is_active = true
      AND id!= COALESCE($5, 0)
      AND (start_time, end_time) OVERLAPS ($3::time, $4::time)
    `,
        [bus_id, day_of_week, start_time, end_time, exclude_id],
      );

      const driverConflict = await db.query(
        `
      SELECT id FROM schedules
      WHERE driver_id = $1 AND day_of_week = $2 AND is_active = true
      AND id!= COALESCE($5, 0)
      AND (start_time, end_time) OVERLAPS ($3::time, $4::time)
    `,
        [driver_id, day_of_week, start_time, end_time, exclude_id],
      );

      res.json({
        hasConflict:
          busConflict.rows.length > 0 || driverConflict.rows.length > 0,
        busConflict: busConflict.rows.length > 0,
        driverConflict: driverConflict.rows.length > 0,
      });
    } catch (err) {
      console.error("Conflict check error:", err);
      res.status(500).json({ error: "Conflict check failed" });
    }
  },
);

// Create schedule
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { bus_id, route_id, driver_id, day_of_week, start_time, end_time } =
      req.body;

    if (start_time >= end_time) {
      return res
        .status(400)
        .json({ error: "End time must be after start time" });
    }

    // Check conflicts
    const conflicts = await checkConflict(
      bus_id,
      driver_id,
      day_of_week,
      start_time,
      end_time,
    );
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      const type = conflict.bus_id === bus_id ? "Bus" : "Driver";
      return res.status(409).json({
        error: `${type} already assigned from ${conflict.start_time.slice(0, 5)} to ${conflict.end_time.slice(0, 5)}`,
      });
    }

    const result = await db.query(
      `
      INSERT INTO schedules (bus_id, route_id, driver_id, day_of_week, start_time, end_time)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
`,
      [bus_id, route_id, driver_id, day_of_week, start_time, end_time],
    );

    res.status(201).json({ schedule: result.rows[0] });
  } catch (err) {
    console.error("Create schedule error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update schedule
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { bus_id, route_id, driver_id, day_of_week, start_time, end_time } =
      req.body;

    if (start_time >= end_time) {
      return res
        .status(400)
        .json({ error: "End time must be after start time" });
    }

    // Check conflicts, exclude current schedule
    const conflicts = await checkConflict(
      bus_id,
      driver_id,
      day_of_week,
      start_time,
      end_time,
      id,
    );
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      const type = conflict.bus_id === bus_id ? "Bus" : "Driver";
      return res.status(409).json({
        error: `${type} already assigned from ${conflict.start_time.slice(0, 5)} to ${conflict.end_time.slice(0, 5)}`,
      });
    }

    const result = await db.query(
      `
      UPDATE schedules
      SET bus_id = $1, route_id = $2, driver_id = $3, day_of_week = $4, start_time = $5, end_time = $6, updated_at = NOW()
      WHERE id = $7 AND is_active = true
      RETURNING *
    `,
      [bus_id, route_id, driver_id, day_of_week, start_time, end_time, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({ schedule: result.rows[0] });
  } catch (err) {
    console.error("Update schedule error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete schedule
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    await db.query("UPDATE schedules SET is_active = false WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ message: "Schedule deleted" });
  } catch (err) {
    console.error("Delete schedule error:", err);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

module.exports = router;
