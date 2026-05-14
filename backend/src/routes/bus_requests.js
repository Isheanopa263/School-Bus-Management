const { sendToToken } = require("../services/fcm");
const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/bus-requests/auto-assign - Student only
 * Auto-assign student to nearest stop + least loaded bus
 */
router.post(
  "/auto-assign",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    const { home_location, notes } = req.body; // home_location: "POINT(lon lat)"

    if (!home_location) {
      return res
        .status(400)
        .json({ error: "home_location required: POINT(lon lat)" });
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Get student record
      const studentResult = await client.query(
        "SELECT sid FROM students WHERE userid = $1",
        [req.user.userid],
      );

      if (studentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Student profile not found" });
      }
      const student_id = studentResult.rows[0].sid;

      // 2. Check if student already has pending request
      const existingReq = await client.query(
        "SELECT id FROM bus_requests WHERE student_id = $1 AND status = $2",
        [student_id, "pending"],
      );
      if (existingReq.rows.length > 0) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: "You already have a pending request" });
      }

      // 3. Update student home_location
      await client.query(
        "UPDATE students SET home_location = ST_GeomFromText($1, 4326) WHERE sid = $2",
        [home_location, student_id],
      );

      // 4. Find nearest stop with available bus capacity within 2km
      const nearestStopQuery = `
        SELECT s.id as stop_id, s.name as stop_name, s.route_id, r.name as route_name,
               b.bid as bus_id, b.registration_number, b.capacity,
               ST_Distance(s.location::geography, ST_GeomFromText($1, 4326)::geography) as distance_m,
               COUNT(st.sid) as current_students,
               (b.capacity - COUNT(st.sid)) as seats_available
        FROM stops s
        JOIN routes r ON s.route_id = r.rid
        JOIN route_assignments ra ON r.rid = ra.route_id
          AND ra.effective_date <= CURRENT_DATE
          AND (ra.end_date IS NULL OR ra.end_date >= CURRENT_DATE)
        JOIN buses b ON ra.bus_id = b.bid
        LEFT JOIN students st ON st.assigned_stop_id = s.id AND st.bus_request_status = 'approved'
        WHERE r.is_active = true
          AND b.status = 'active'
          AND ST_DWithin(s.location::geography, ST_GeomFromText($1, 4326)::geography, 2000)
        GROUP BY s.id, s.name, s.route_id, r.name, b.bid, b.registration_number, b.capacity
        HAVING b.capacity > COUNT(st.sid)
        ORDER BY distance_m ASC, seats_available DESC
        LIMIT 1;
      `;

      const stopResult = await client.query(nearestStopQuery, [home_location]);

      if (stopResult.rows.length === 0) {
        // No bus with capacity found - create waitlist request
        const { rows } = await client.query(
          `INSERT INTO bus_requests (student_id, home_location, status, notes, requested_by, auto_assigned)
           VALUES ($1, ST_GeomFromText($2, 4326), 'pending', $3, $4, true)
           RETURNING *`,
          [
            student_id,
            home_location,
            notes ||
              "Auto-assignment: No seats available nearby. Added to waitlist.",
            req.user.userid,
          ],
        );
        await client.query("COMMIT");

        return res.status(201).json({
          request: rows[0],
          message:
            "No buses with available seats within 2km. Added to waitlist.",
        });
      }

      const assignment = stopResult.rows[0];

      // 5. Create approved bus request
      const { rows: requestRows } = await client.query(
        `INSERT INTO bus_requests (student_id, requested_stop_id, requested_route_id, home_location,
                                   status, notes, requested_by, auto_assigned)
         VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), 'approved', $5, $6, true)
         RETURNING *`,
        [
          student_id,
          assignment.stop_id,
          assignment.route_id,
          home_location,
          notes ||
            `Auto-assigned to ${assignment.stop_name}, ${Math.round(assignment.distance_m)}m from home`,
          req.user.userid,
        ],
      );

      // 6. Update student record immediately
      await client.query(
        `UPDATE students SET assigned_stop_id = $1, bus_request_status = 'approved' WHERE sid = $2`,
        [assignment.stop_id, student_id],
      );

      await client.query("COMMIT");

      // 7. Send FCM notification for approved request
      const userResult = await db.query(
        `SELECT u.fcm_token, u.full_name FROM students s
         JOIN users u ON s.userid = u.userid WHERE s.sid = $1`,
        [student_id],
      );
      if (userResult.rows[0]?.fcm_token) {
        await sendToToken(
          userResult.rows[0].fcm_token,
          "Bus Request Approved",
          `Your bus to ${assignment.route_name} has been approved`,
          { type: "bus_approved", request_id: requestRows[0].id },
        );
      }

      res.status(201).json({
        request: requestRows[0],
        assignment: {
          stop_name: assignment.stop_name,
          route_name: assignment.route_name,
          bus_number: assignment.registration_number,
          distance_meters: Math.round(assignment.distance_m),
          seats_remaining: assignment.seats_available - 1,
        },
        message: "Auto-assigned successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Auto-assign error:", err);
      res.status(500).json({ error: "Auto-assignment failed" });
    } finally {
      client.release();
    }
  },
);

/**
 * GET /api/bus-requests - Admin: list all requests
 * Query:?status=pending|approved|rejected
 */
router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT br.id,
             br.student_id,
             br.requested_stop_id,
             br.requested_route_id,
             br.status,
             br.notes,
             br.auto_assigned,
             br.created_at,
             br.updated_at,
             u.full_name  AS student_name,
             u.email      AS student_email,
             u.phone      AS student_phone,
             s.roll,
             s.emergency_contact_phone,
             st.id        AS stop_id,
             st.name      AS stop_name,
             r.rid        AS route_id,
             r.name       AS route_name,
             CASE 
               WHEN br.home_location IS NOT NULL 
               THEN ST_X(br.home_location::geometry) 
               ELSE NULL 
             END AS home_lng,
             CASE 
               WHEN br.home_location IS NOT NULL 
               THEN ST_Y(br.home_location::geometry) 
               ELSE NULL 
             END AS home_lat
      FROM bus_requests br
      JOIN students s ON br.student_id = s.sid
      JOIN users u ON s.userid = u.userid
      LEFT JOIN stops st ON br.requested_stop_id = st.id
      LEFT JOIN routes r ON br.requested_route_id = r.rid
    `;
    const params = [];

    if (status) {
      query += " WHERE br.status = $1";
      params.push(status);
    }

    query += " ORDER BY br.created_at DESC";

    const { rows } = await db.query(query, params);
    res.json({ requests: rows });
  } catch (err) {
    console.error("Get requests error:", err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});
/**
 * PUT /api/bus-requests/:id/approve - Admin: manually approve + assign stop
 */
router.put(
  "/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    const { stop_id, route_id, admin_notes } = req.body;

    if (!stop_id || !route_id) {
      return res.status(400).json({ error: "stop_id and route_id required" });
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Update request - use correct column names
      const { rows: requestRows } = await client.query(
        `UPDATE bus_requests
         SET status             = 'approved',
             requested_stop_id  = $1,
             requested_route_id = $2,
             notes              = COALESCE($3, notes),
             approved_by        = $4,
             updated_at         = NOW()
         WHERE id = $5 AND status = 'pending'
         RETURNING student_id`,
        [stop_id, route_id, admin_notes, req.user.userid, id],
      );

      if (requestRows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Request not found or already processed" });
      }

      const student_id = requestRows[0].student_id;

      // 2. Update student record
      await client.query(
        `UPDATE students
         SET assigned_stop_id   = $1,
             bus_request_status = 'approved'
         WHERE sid = $2`,
        [stop_id, student_id],
      );

      await client.query("COMMIT");
      res.json({ message: "Request approved successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Approve request error:", err);
      res.status(500).json({ error: "Failed to approve request" });
    } finally {
      client.release();
    }
  },
);

/**
 * PUT /api/bus-requests/:id/reject - Admin: reject request
 */
router.put(
  "/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      const { rows } = await db.query(
        `UPDATE bus_requests
         SET status     = 'rejected',
             notes      = COALESCE($1, notes),
             approved_by = $2,
             updated_at  = NOW()
         WHERE id = $3 AND status = 'pending'
         RETURNING student_id`,
        [admin_notes, req.user.userid, id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Request not found or already processed" });
      }

      // Update student status
      await db.query(
        "UPDATE students SET bus_request_status = 'rejected' WHERE sid = $1",
        [rows[0].student_id],
      );

      res.json({ message: "Request rejected" });
    } catch (err) {
      console.error("Reject request error:", err);
      res.status(500).json({ error: "Failed to reject request" });
    }
  },
);

/**
 * GET /api/bus-requests - Admin: list all requests
 */

/**
 * POST /api/bus-requests/request
 * Student submits a pending bus request (admin approves manually)
 */
router.post(
  "/request",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    const { home_location, notes } = req.body;
    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // Get student record
      const studentResult = await client.query(
        "SELECT sid, bus_request_status FROM students WHERE userid = $1",
        [req.user.userid],
      );

      if (studentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Student profile not found" });
      }

      const student = studentResult.rows[0];

      // Check if already has active request or approved
      if (student.bus_request_status === "approved") {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: "You already have an approved bus assignment" });
      }

      if (student.bus_request_status === "pending") {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: "You already have a pending request" });
      }

      // Before inserting check and delete old rejected/cancelled requests
      await client.query(
        `DELETE FROM bus_requests 
   WHERE student_id = $1 
   AND status IN ('rejected', 'cancelled')`,
        [student.sid],
      );
      // Create pending request
      const { rows } = await client.query(
        `INSERT INTO bus_requests 
          (student_id, home_location, status, notes, requested_by, auto_assigned)
         VALUES (
           $1,
           ${home_location ? "ST_GeomFromText($2, 4326)" : "NULL"},
           'pending',
           $3,
           $4,
           false
         )
         RETURNING id, status, created_at`,
        home_location
          ? [student.sid, home_location, notes || null, req.user.userid]
          : [student.sid, notes || null, req.user.userid],
      );

      // Update student status to pending
      await client.query(
        "UPDATE students SET bus_request_status = 'pending' WHERE sid = $1",
        [student.sid],
      );

      await client.query("COMMIT");

      res.status(201).json({
        request: rows[0],
        message: "Bus request submitted. Admin will review shortly.",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Bus request error:", err);
      res.status(500).json({ error: "Failed to submit request" });
    } finally {
      client.release();
    }
  },
);

module.exports = router;
