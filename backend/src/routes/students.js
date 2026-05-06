const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashPassword } = require("../utils/hash");

const router = express.Router();

/**
 * POST /api/students - Admin only
 * Creates user + student record
 */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const {
    full_name,
    email,
    phone,
    password,
    roll,
    assigned_stop_id,
    emergency_contact_phone,
  } = req.body;

  if (!full_name || !phone || !password) {
    return res
      .status(400)
      .json({ error: "full_name, phone, password required" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create user
    const password_hash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ('student', $1, $2, $3, $4)
       RETURNING userid, full_name, email, phone`,
      [full_name, email, phone, password_hash],
    );
    const user = userResult.rows[0];

    // 2. Create student
    const studentResult = await client.query(
      `INSERT INTO students (userid, roll, assigned_stop_id, emergency_contact_phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.userid, roll, assigned_stop_id, emergency_contact_phone],
    );

    await client.query("COMMIT");
    res.status(201).json({
      user,
      student: studentResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email or phone already exists" });
    }
    console.error("Create student error:", err);
    res.status(500).json({ error: "Failed to create student" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/students - Admin, Driver
 */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "driver"]),
  async (req, res) => {
    try {
      const { rows } = await db.query(`
      SELECT s.*,
             u.full_name, u.email, u.phone, u.is_active,
             st.name as stop_name,
             ST_AsText(st.location) as stop_location
      FROM students s
      JOIN users u ON s.userid = u.userid
      LEFT JOIN stops st ON s.assigned_stop_id = st.id
      ORDER BY u.full_name
    `);
      res.json({ students: rows });
    } catch (err) {
      console.error("Get students error:", err);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  },
);

/**
 * PUT /api/students/:id - Admin only
 * Updates both users and students table
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    email,
    phone,
    roll,
    assigned_stop_id,
    emergency_contact_phone,
    bus_request_status,
  } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Get userid from sid
    const studentCheck = await client.query(
      "SELECT userid FROM students WHERE sid = $1",
      [id],
    );
    if (studentCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }
    const userid = studentCheck.rows[0].userid;

    // Update users table
    await client.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           updated_at = NOW()
       WHERE userid = $4`,
      [full_name, email, phone, userid],
    );

    // Update students table
    const { rows } = await client.query(
      `UPDATE students
       SET roll = COALESCE($1, roll),
           assigned_stop_id = COALESCE($2, assigned_stop_id),
           emergency_contact_phone = COALESCE($3, emergency_contact_phone),
           bus_request_status = COALESCE($4, bus_request_status)
       WHERE sid = $5
       RETURNING *`,
      [roll, assigned_stop_id, emergency_contact_phone, bus_request_status, id],
    );

    await client.query("COMMIT");
    res.json({ student: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update student error:", err);
    res.status(500).json({ error: "Failed to update student" });
  } finally {
    client.release();
  }
});

module.exports = router;
