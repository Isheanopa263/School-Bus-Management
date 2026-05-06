const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/bus-requests - Student only
 * Student requests bus assignment to a stop
 */
router.post("/", requireAuth, requireRole(["student"]), async (req, res) => {
  const { requested_stop_id, notes } = req.body;

  if (!requested_stop_id) {
    return res.status(400).json({ error: "requested_stop_id required" });
  }

  try {
    // 1. Get student record for logged-in user
    const studentResult = await db.query(
      "SELECT sid FROM students WHERE userid = $1",
      [req.user.userid],
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: "Student profile not found" });
    }
    const student_id = studentResult.rows[0].sid;

    // 2. Get route_id from stop
    const stopResult = await db.query(
      "SELECT route_id FROM stops WHERE id = $1",
      [requested_stop_id],
    );

    if (stopResult.rows.length === 0) {
      return res.status(404).json({ error: "Stop not found" });
    }
    const requested_route_id = stopResult.rows[0].route_id;

    // 3. Create request
    const { rows } = await db.query(
      `INSERT INTO bus_requests (student_id, requested_stop_id, requested_route_id, notes, requested_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        student_id,
        requested_stop_id,
        requested_route_id,
        notes,
        req.user.userid,
      ],
    );

    res.status(201).json({ request: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "You already have a pending request" });
    }
    console.error("Create bus request error:", err);
    res.status(500).json({ error: "Failed to create request" });
  }
});

/**
 * GET /api/bus-requests - Admin sees all, Student sees own
 */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "student"]),
  async (req, res) => {
    const { status } = req.query;

    try {
      let query = `
      SELECT br.*,
             s.roll, u.full_name as student_name, u.phone as student_phone,
             st.name as stop_name, st.sequence_number,
             r.name as route_name,
             admin.full_name as approved_by_name
      FROM bus_requests br
      JOIN students s ON br.student_id = s.sid
      JOIN users u ON s.userid = u.userid
      JOIN stops st ON br.requested_stop_id = st.id
      JOIN routes r ON br.requested_route_id = r.rid
      LEFT JOIN users admin ON br.approved_by = admin.userid
    `;
      const params = [];

      // Student sees only their requests
      if (req.user.role === "student") {
        query += " WHERE s.userid = $1";
        params.push(req.user.userid);
      }

      // Filter by status
      if (status) {
        query +=
          req.user.role === "student"
            ? " AND br.status = $2"
            : " WHERE br.status = $1";
        params.push(status);
      }

      query += " ORDER BY br.created_at DESC";

      const { rows } = await db.query(query, params);
      res.json({ requests: rows });
    } catch (err) {
      console.error("Get bus requests error:", err);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  },
);

/**
 * PUT /api/bus-requests/:id - Admin only
 * Approve or reject request
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body; // status: 'approved' or 'rejected'

  if (!["approved", "rejected"].includes(status)) {
    return res
      .status(400)
      .json({ error: "Status must be approved or rejected" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Update request
    const requestResult = await client.query(
      `UPDATE bus_requests
       SET status = $1, approved_by = $2, updated_at = NOW(), notes = COALESCE($3, notes)
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [status, req.user.userid, notes, id],
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: "Request not found or already processed" });
    }
    const request = requestResult.rows[0];

    // 2. If approved, update student record
    if (status === "approved") {
      await client.query(
        `UPDATE students
         SET assigned_stop_id = $1, bus_request_status = 'approved'
         WHERE sid = $2`,
        [request.requested_stop_id, request.student_id],
      );
    } else {
      // If rejected
      await client.query(
        `UPDATE students SET bus_request_status = 'rejected' WHERE sid = $1`,
        [request.student_id],
      );
    }

    await client.query("COMMIT");
    res.json({ request, message: `Request ${status}` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update bus request error:", err);
    res.status(500).json({ error: "Failed to update request" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/bus-requests/:id - Student cancels own pending request
 */
router.delete(
  "/:id",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const { rowCount } = await db.query(
        `DELETE FROM bus_requests
       WHERE id = $1 AND requested_by = $2 AND status = 'pending'`,
        [req.params.id, req.user.userid],
      );

      if (rowCount === 0) {
        return res
          .status(404)
          .json({ error: "Request not found or cannot be cancelled" });
      }
      res.json({ message: "Request cancelled" });
    } catch (err) {
      console.error("Delete bus request error:", err);
      res.status(500).json({ error: "Failed to cancel request" });
    }
  },
);

module.exports = router;
