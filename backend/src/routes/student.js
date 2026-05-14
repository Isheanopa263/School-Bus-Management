const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/student/profile
 * Student gets own full profile + assignment details
 */
router.get(
  "/profile",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT 
        s.sid,
        s.roll,
        s.bus_request_status,
        s.emergency_contact_phone,
        u.userid,
        u.full_name,
        u.email,
        u.phone,
        u.created_at,
        st.id     AS stop_id,
        st.name   AS stop_name,
        st.sequence_number,
        st.scheduled_arrival_time,
        r.rid     AS route_id,
        r.name    AS route_name,
        r.total_distance_km,
        r.estimated_duration_min,
        b.bid     AS bus_id,
        b.registration_number AS bus_number,
        b.capacity,
        d_user.full_name AS driver_name,
        d_user.phone     AS driver_phone
       FROM students s
       JOIN users u ON s.userid = u.userid
       LEFT JOIN stops st ON s.assigned_stop_id = st.id
       LEFT JOIN routes r ON st.route_id = r.rid
       LEFT JOIN route_assignments ra ON r.rid = ra.route_id
         AND ra.effective_date <= CURRENT_DATE
         AND (ra.end_date IS NULL OR ra.end_date >= CURRENT_DATE)
       LEFT JOIN buses b ON ra.bus_id = b.bid
       LEFT JOIN drivers d ON ra.driver_id = d.id
       LEFT JOIN users d_user ON d.userid = d_user.userid
       WHERE s.userid = $1`,
        [req.user.userid],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      res.json({ profile: rows[0] });
    } catch (err) {
      console.error("Get student profile error:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  },
);

/**
 * PUT /api/student/profile
 * Student updates own profile
 */
router.put(
  "/profile",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    const { full_name, phone, emergency_contact_phone, roll } = req.body;
    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // Update users table
      await client.query(
        `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone     = COALESCE($2, phone)
       WHERE userid = $3`,
        [full_name, phone, req.user.userid],
      );

      // Update students table
      await client.query(
        `UPDATE students
       SET emergency_contact_phone = COALESCE($1, emergency_contact_phone),
           roll = COALESCE($2, roll)
       WHERE userid = $3`,
        [emergency_contact_phone, roll, req.user.userid],
      );

      await client.query("COMMIT");
      res.json({ message: "Profile updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update profile error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    } finally {
      client.release();
    }
  },
);

/**
 * POST /api/student/leave-bus
 * Student opts out of bus service
 */
router.post(
  "/leave-bus",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const studentResult = await client.query(
        "SELECT sid FROM students WHERE userid = $1",
        [req.user.userid],
      );

      if (studentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Student profile not found" });
      }

      const sid = studentResult.rows[0].sid;

      // Remove assignment from student
      await client.query(
        `UPDATE students
         SET assigned_stop_id   = NULL,
             bus_request_status = 'inactive'
         WHERE sid = $1`,
        [sid],
      );

      // DELETE bus requests (no 'closed' status in constraint)
      await client.query(`DELETE FROM bus_requests WHERE student_id = $1`, [
        sid,
      ]);

      await client.query("COMMIT");
      res.json({ message: "Successfully removed from bus service" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Leave bus error:", err);
      res.status(500).json({ error: "Failed to leave bus service" });
    } finally {
      client.release();
    }
  },
);

/**
 * GET /api/student/requests
 * Student views own bus requests history
 */
router.get(
  "/requests",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const studentResult = await db.query(
        "SELECT sid FROM students WHERE userid = $1",
        [req.user.userid],
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      const sid = studentResult.rows[0].sid;

      const { rows } = await db.query(
        `SELECT br.*,
              st.name AS stop_name,
              r.name  AS route_name
       FROM bus_requests br
       LEFT JOIN stops st ON br.requested_stop_id = st.id
       LEFT JOIN routes r ON br.requested_route_id = r.rid
       WHERE br.student_id = $1
       ORDER BY br.created_at DESC`,
        [sid],
      );

      res.json({ requests: rows });
    } catch (err) {
      console.error("Get student requests error:", err);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  },
);

/**
 * GET /api/student/notifications
 * Student views own notifications
 */
router.get(
  "/notifications",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT 50`,
        [req.user.userid],
      );

      res.json({ notifications: rows });
    } catch (err) {
      console.error("Get notifications error:", err);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  },
);

/**
 * POST /api/student/complaints
 * Student raises a complaint
 */
router.post(
  "/complaints",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    const { category, description, priority, driver_id, bus_id } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO complaints 
        (raised_by, driver_id, bus_id, category, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING id, category, description, priority, status, created_at`,
        [
          req.user.userid,
          driver_id || null,
          bus_id || null,
          category || "other",
          description,
          priority || "medium",
        ],
      );

      res.status(201).json({
        complaint: rows[0],
        message: "Complaint submitted successfully",
      });
    } catch (err) {
      console.error("Create complaint error:", err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  },
);

/**
 * PUT /api/student/change-password
 */
router.put(
  "/change-password",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res
        .status(400)
        .json({ error: "Current and new password required" });
    }

    if (new_password.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    }

    try {
      // Get current hash
      const { rows } = await db.query(
        "SELECT password_hash FROM users WHERE userid = $1",
        [req.user.userid],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const { comparePassword, hashPassword } = require("../utils/hash");
      const valid = await comparePassword(
        current_password,
        rows[0].password_hash,
      );
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Update password
      const newHash = await hashPassword(new_password);
      await db.query("UPDATE users SET password_hash = $1 WHERE userid = $2", [
        newHash,
        req.user.userid,
      ]);

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  },
);

module.exports = router;
