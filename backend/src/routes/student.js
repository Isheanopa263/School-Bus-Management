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

      // Notify admins about new complaint
      try {
        const { notifyAdmins } = require("../services/notify");
        const studentInfo = await db.query(
          "SELECT u.full_name FROM users u WHERE u.userid = $1",
          [req.user.userid],
        );
        const studentName = studentInfo.rows[0]?.full_name || "Student";

        await notifyAdmins(
          "⚠️ New Student Complaint",
          `${studentName} submitted a ${category || "general"} complaint`,
          { type: "new_complaint", complaint_id: rows[0].id },
        );
      } catch (notifyErr) {
        console.warn(
          "[NOTIFY] Admin complaint notification failed:",
          notifyErr.message,
        );
      }

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

/**
 * GET /api/student/tracking/live
 * Returns live bus position + ETA to student's assigned stop
 */
router.get(
  "/tracking/live",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      // 1. Get student profile + assigned stop
      const profileResult = await db.query(
        `SELECT 
          s.sid,
          s.assigned_stop_id,
          s.bus_request_status,
          st.name     AS stop_name,
          ST_Y(st.location::geometry) AS stop_lat,
          ST_X(st.location::geometry) AS stop_lng,
          r.rid       AS route_id,
          b.bid       AS bus_id,
          b.registration_number AS bus_number
         FROM students s
         LEFT JOIN stops st ON s.assigned_stop_id = st.id
         LEFT JOIN routes r ON st.route_id = r.rid
         LEFT JOIN route_assignments ra ON r.rid = ra.route_id
           AND ra.effective_date <= CURRENT_DATE
           AND (ra.end_date IS NULL OR ra.end_date >= CURRENT_DATE)
         LEFT JOIN buses b ON ra.bus_id = b.bid
         WHERE s.userid = $1`,
        [req.user.userid],
      );

      if (profileResult.rows.length === 0) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      const profile = profileResult.rows[0];

      // Must have approved assignment
      if (profile.bus_request_status !== "approved" || !profile.bus_id) {
        return res.status(404).json({
          error: "No active bus assignment",
          bus_request_status: profile.bus_request_status,
        });
      }

      // 2. Get latest bus location
      const locationResult = await db.query(
        `SELECT 
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          speed_kmh,
          heading,
          recorded_at,
          trip_id
         FROM live_locations
         WHERE bus_id = $1
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [profile.bus_id],
      );

      if (locationResult.rows.length === 0) {
        return res.json({
          bus: null,
          stop: {
            stop_id: profile.assigned_stop_id,
            stop_name: profile.stop_name,
            latitude: profile.stop_lat,
            longitude: profile.stop_lng,
          },
          eta: null,
          trip_status: "no_signal",
          message: "Bus is not currently broadcasting location",
        });
      }

      const busLocation = locationResult.rows[0];

      // 3. Get active trip status
      const tripResult = await db.query(
        `SELECT id, status, trip_type, start_time
         FROM trips
         WHERE id = $1`,
        [busLocation.trip_id],
      );

      const trip = tripResult.rows[0] || null;

      // 4. Calculate ETA using OSRM
      let eta = null;
      if (profile.stop_lat && profile.stop_lng) {
        const { getETA } = require("../services/osrm");
        eta = await getETA(
          parseFloat(busLocation.latitude),
          parseFloat(busLocation.longitude),
          parseFloat(profile.stop_lat),
          parseFloat(profile.stop_lng),
          parseFloat(busLocation.speed_kmh || 30),
        );
      }

      // 5. Check if stop already visited
      let stopVisited = false;
      if (busLocation.trip_id && profile.assigned_stop_id) {
        const visitResult = await db.query(
          `SELECT id FROM trip_stop_visits
           WHERE trip_id = $1 AND stop_id = $2`,
          [busLocation.trip_id, profile.assigned_stop_id],
        );
        stopVisited = visitResult.rows.length > 0;
      }

      res.json({
        bus: {
          bus_id: profile.bus_id,
          bus_number: profile.bus_number,
          latitude: parseFloat(busLocation.latitude),
          longitude: parseFloat(busLocation.longitude),
          speed_kmh: parseFloat(busLocation.speed_kmh || 0),
          heading: parseFloat(busLocation.heading || 0),
          recorded_at: busLocation.recorded_at,
        },
        stop: {
          stop_id: profile.assigned_stop_id,
          stop_name: profile.stop_name,
          latitude: profile.stop_lat ? parseFloat(profile.stop_lat) : null,
          longitude: profile.stop_lng ? parseFloat(profile.stop_lng) : null,
          already_visited: stopVisited,
        },
        eta,
        trip_status: trip?.status || "unknown",
        trip_type: trip?.trip_type || null,
      });
    } catch (err) {
      console.error("Student live tracking error:", err);
      res.status(500).json({ error: "Failed to fetch tracking data" });
    }
  },
);

/**
 * GET /api/student/attendance
 * Student views own attendance history
 */
router.get(
  "/attendance",
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
        `SELECT 
          sa.id,
          sa.event_type,
          sa.timestamp,
          sa.trip_id,
          t.trip_date,
          t.trip_type,
          st.name as stop_name,
          r.name as route_name
         FROM student_attendance sa
         LEFT JOIN trips t ON sa.trip_id = t.id
         LEFT JOIN stops st ON sa.stop_id = st.id
         LEFT JOIN route_assignments ra ON t.assignment_id = ra.id
         LEFT JOIN routes r ON ra.route_id = r.rid
         WHERE sa.student_id = $1
         ORDER BY sa.timestamp DESC
         LIMIT 50`,
        [sid],
      );

      res.json({ attendance: rows });
    } catch (err) {
      console.error("Get student attendance error:", err);
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  },
);
module.exports = router;
