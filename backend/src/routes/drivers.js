const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashPassword } = require("../utils/hash");

const router = express.Router();

/**
 * POST /api/drivers - Admin only
 * Creates user + driver record
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const {
    full_name,
    email,
    phone,
    password,
    license_number,
    license_expiry,
    current_bus_id,
  } = req.body;

  if (!full_name || !phone || !password || !license_number || !license_expiry) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create user
    const password_hash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ('driver', $1, $2, $3, $4)
       RETURNING userid, full_name, email, phone`,
      [full_name, email, phone, password_hash],
    );
    const user = userResult.rows[0];

    // 2. Create driver
    const driverResult = await client.query(
      `INSERT INTO drivers (userid, license_number, license_expiry, current_bus_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.userid, license_number, license_expiry, current_bus_id],
    );

    await client.query("COMMIT");
    res.status(201).json({
      user,
      driver: driverResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Email, phone, or license number already exists" });
    }
    console.error("Create driver error:", err);
    res.status(500).json({ error: "Failed to create driver" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/drivers - Admin only
 */
router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*,
             u.full_name, u.email, u.phone, u.is_active,
             b.registration_number as bus_number
      FROM drivers d
      JOIN users u ON d.userid = u.userid
      LEFT JOIN buses b ON d.current_bus_id = b.bid
      ORDER BY u.full_name
    `);
    res.json({ drivers: rows });
  } catch (err) {
    console.error("Get drivers error:", err);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

/**
 * PUT /api/drivers/:id - Admin only
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { license_number, license_expiry, employment_status, current_bus_id } =
    req.body;

  try {
    const { rows } = await db.query(
      `UPDATE drivers
       SET license_number = COALESCE($1, license_number),
           license_expiry = COALESCE($2, license_expiry),
           employment_status = COALESCE($3, employment_status),
           current_bus_id = COALESCE($4, current_bus_id)
       WHERE id = $5
       RETURNING *`,
      [license_number, license_expiry, employment_status, current_bus_id, id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.json({ driver: rows[0] });
  } catch (err) {
    console.error("Update driver error:", err);
    res.status(500).json({ error: "Failed to update driver" });
  }
});

/**
 * DELETE /api/drivers/:id - Admin only
 * Soft deletes driver and deactivates user account
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // Get userid first
    const driverResult = await client.query(
      "SELECT userid FROM drivers WHERE id = $1",
      [id],
    );

    if (driverResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Driver not found" });
    }

    const userid = driverResult.rows[0].userid;

    // Soft delete driver
    await client.query(
      `DELETE FROM drivers
       WHERE id = $1`,
      [id],
    );

    // Deactivate user account
    await client.query("UPDATE users SET is_active = false WHERE userid = $1", [
      userid,
    ]);

    await client.query("COMMIT");
    res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete driver error:", err);
    res.status(500).json({ error: "Failed to delete driver" });
  } finally {
    client.release();
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.id, 
        u.full_name as name, 
        d.license_number 
      FROM drivers d 
      JOIN users u ON d.userid = u.userid 
      WHERE d.employment_status = 'active'
    `);
    res.json({ drivers: result.rows });
  } catch (err) {
    console.error("Get drivers error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
