const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendToTokens } = require("../services/fcm");

const router = express.Router();

/**
 * POST /api/tickets - Student/Driver raises ticket
 */
router.post(
  "/",
  requireAuth,
  requireRole(["student", "driver"]),
  async (req, res) => {
    const { category, description, trip_id, priority } = req.body;

    if (!category || !description) {
      return res
        .status(400)
        .json({ error: "category and description required" });
    }

    const validCategories = [
      "overspeeding",
      "missed_stop",
      "rude_driver",
      "breakdown",
      "app_bug",
      "other",
    ];
    if (!validCategories.includes(category)) {
      return res
        .status(400)
        .json({
          error: `Invalid category. Must be: ${validCategories.join(", ")}`,
        });
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO tickets (raised_by, category, description, trip_id, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
        [
          req.user.userid,
          category,
          description,
          trip_id || null,
          priority || "normal",
        ],
      );

      // Notify admins
      const adminsResult = await db.query(
        `SELECT fcm_token FROM users WHERE role = 'admin' AND fcm_token IS NOT NULL`,
      );
      const tokens = adminsResult.rows.map((r) => r.fcm_token);
      if (tokens.length) {
        await sendToTokens(
          tokens,
          "New Ticket Raised",
          `${category}: ${description.substring(0, 50)}...`,
          { type: "new_ticket", ticket_id: rows[0].id },
        );
      }

      res.status(201).json({ ticket: rows[0] });
    } catch (err) {
      console.error("Create ticket error:", err);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  },
);

/**
 * GET /api/tickets - List tickets
 * Admin: all tickets
 * Student/Driver: only their own tickets
 */
router.get("/", requireAuth, async (req, res) => {
  const { status, category } = req.query;

  try {
    let query = `
      SELECT t.*,
             u.full_name as raised_by_name, u.email as raised_by_email,
             trip.id as trip_id, r.name as route_name
      FROM tickets t
      JOIN users u ON t.raised_by = u.userid
      LEFT JOIN trips trip ON t.trip_id = trip.id
      LEFT JOIN route_assignments ra ON trip.assignment_id = ra.id
      LEFT JOIN routes r ON ra.route_id = r.rid
    `;
    const params = [];
    const conditions = [];

    // Role-based filter
    if (req.user.role !== "admin") {
      conditions.push(`t.raised_by = $${params.length + 1}`);
      params.push(req.user.userid);
    }

    if (status) {
      conditions.push(`t.status = $${params.length + 1}`);
      params.push(status);
    }
    if (category) {
      conditions.push(`t.category = $${params.length + 1}`);
      params.push(category);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY t.created_at DESC";

    const { rows } = await db.query(query, params);
    res.json({ tickets: rows });
  } catch (err) {
    console.error("Get tickets error:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * GET /api/tickets/:id - Get single ticket
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*,
              u.full_name as raised_by_name, u.email as raised_by_email,
              trip.id as trip_id, r.name as route_name,
              b.registration_number as bus_number
       FROM tickets t
       JOIN users u ON t.raised_by = u.userid
       LEFT JOIN trips trip ON t.trip_id = trip.id
       LEFT JOIN route_assignments ra ON trip.assignment_id = ra.id
       LEFT JOIN routes r ON ra.route_id = r.rid
       LEFT JOIN buses b ON ra.bus_id = b.bid
       WHERE t.id = $1`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Check permission: admin or owner
    if (req.user.role !== "admin" && rows[0].raised_by !== req.user.userid) {
      return res
        .status(403)
        .json({ error: "Not authorized to view this ticket" });
    }

    res.json({ ticket: rows[0] });
  } catch (err) {
    console.error("Get ticket error:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

/**
 * PUT /api/tickets/:id - Admin only: update status/resolution
 */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const { status, resolution, priority } = req.body;

  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  if (status && !validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: `Invalid status. Must be: ${validStatuses.join(", ")}` });
  }

  try {
    const { rows } = await db.query(
      `UPDATE tickets
       SET status = COALESCE($1, status),
           resolution = COALESCE($2, resolution),
           priority = COALESCE($3, priority),
           updated_at = NOW(),
           resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END
       WHERE id = $4
       RETURNING *`,
      [status, resolution, priority, id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Notify ticket owner if resolved/closed
    if (["resolved", "closed"].includes(status)) {
      const userResult = await db.query(
        "SELECT fcm_token FROM users WHERE userid = $1",
        [rows[0].raised_by],
      );
      if (userResult.rows[0]?.fcm_token) {
        await sendToTokens(
          [userResult.rows[0].fcm_token],
          "Ticket Updated",
          `Your ticket "${rows[0].category}" is now ${status}`,
          { type: "ticket_update", ticket_id: id },
        );
      }
    }

    res.json({ ticket: rows[0] });
  } catch (err) {
    console.error("Update ticket error:", err);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

module.exports = router;
