const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/complaints - Admin: list all complaints
 * Query:?status=open|in_progress|resolved|closed
 */
router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT c.*,
             u.full_name as raised_by_name,
             u.role as raised_by_role,
             d.license_number as driver_license,
             b.registration_number as bus_number,
             t.trip_date,
             t.trip_type
      FROM complaints c
      LEFT JOIN users u ON c.raised_by = u.userid
      LEFT JOIN drivers d ON c.driver_id = d.id
      LEFT JOIN buses b ON c.bus_id = b.bid
      LEFT JOIN trips t ON c.trip_id = t.id
    `;
    const params = [];

    if (status) {
      query += " WHERE c.status = $1";
      params.push(status);
    }

    query += " ORDER BY c.created_at DESC";

    const { rows } = await db.query(query, params);
    res.json({ complaints: rows });
  } catch (err) {
    console.error("Get complaints error:", err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

/**
 * PUT /api/complaints/:id/resolve - Admin: update status + notes
 */
router.put(
  "/:id/resolve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    const { status, resolution_notes, priority } = req.body;

    try {
      // Fix: Cast $1 explicitly to varchar to avoid type conflict
      const { rows } = await db.query(
        `UPDATE complaints
         SET status           = $1::varchar,
             resolution_notes = $2,
             priority         = COALESCE($3::varchar, priority),
             resolved_at      = CASE 
                                  WHEN $1::varchar = 'resolved' 
                                  THEN NOW() 
                                  ELSE resolved_at 
                                END
         WHERE id = $4
         RETURNING *`,
        [status, resolution_notes, priority, id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      // If complaint was from a driver, notify them
      const complaint = rows[0];
      if (
        complaint.driver_id &&
        (status === "resolved" || status === "in_progress")
      ) {
        try {
          const { notifyDriver } = require("../services/notify");
          await notifyDriver(
            complaint.driver_id,
            `✅ Issue ${status === "resolved" ? "Resolved" : "Being Reviewed"}`,
            `Your reported ${complaint.category || "issue"} has been ${status.replace("_", " ")}`,
            { type: "issue_update", complaint_id: complaint.id },
          );
        } catch (notifyErr) {
          console.warn(
            "[NOTIFY] Driver notification failed:",
            notifyErr.message,
          );
        }
      }

      res.json({ complaint: rows[0], message: "Complaint updated" });
    } catch (err) {
      console.error("Update complaint error:", err);
      res.status(500).json({ error: "Failed to update complaint" });
    }
  },
);

module.exports = router;
