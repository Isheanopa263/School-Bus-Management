const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/buses - Admin only
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { registration_number, capacity, model, gps_device_id } = req.body;

  if (!registration_number || !capacity) {
    return res
      .status(400)
      .json({ error: "registration_number and capacity required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO buses (registration_number, capacity, model, gps_device_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [registration_number, capacity, model, gps_device_id],
    );
    res.status(201).json({ bus: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Registration number or GPS device ID already exists" });
    }
    console.error("Create bus error:", err);
    res.status(500).json({ error: "Failed to create bus" });
  }
});

/**
 * GET /api/buses - Admin, Driver can view
 */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "driver"]),
  async (req, res) => {
    try {
      const { rows } = await db.query(`
      SELECT b.*,
             d.license_number,
             u.full_name as driver_name
      FROM buses b
      LEFT JOIN drivers d ON b.bid = d.current_bus_id
      LEFT JOIN users u ON d.userid = u.userid
      WHERE b.status = 'active'
      ORDER BY b.registration_number
    `);
      res.json({ buses: rows });
    } catch (err) {
      console.error("Get buses error:", err);
      res.status(500).json({ error: "Failed to fetch buses" });
    }
  },
);

/**
 * PUT /api/buses/:id - Admin only
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { registration_number, capacity, model, gps_device_id, status } =
    req.body;

  try {
    const { rows } = await db.query(
      `UPDATE buses
       SET registration_number = COALESCE($1, registration_number),
           capacity = COALESCE($2, capacity),
           model = COALESCE($3, model),
           gps_device_id = COALESCE($4, gps_device_id),
           status = COALESCE($5, status)
       WHERE bid = $6
       RETURNING *`,
      [registration_number, capacity, model, gps_device_id, status, id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Bus not found" });
    }
    res.json({ bus: rows[0] });
  } catch (err) {
    console.error("Update bus error:", err);
    res.status(500).json({ error: "Failed to update bus" });
  }
});

module.exports = router;
