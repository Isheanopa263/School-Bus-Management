// routes/stats.js
const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const queries = [
      db.query("SELECT COUNT(*) as total_buses FROM buses"),
      db.query(
        "SELECT COUNT(*) as active_buses FROM buses WHERE status = 'active'",
      ),
      db.query("SELECT COUNT(*) as total_drivers FROM drivers"),
      db.query(
        "SELECT COUNT(*) as active_drivers FROM drivers WHERE employment_status = 'active'",
      ),
      db.query(
        "SELECT COUNT(*) as pending_requests FROM bus_requests WHERE status = 'pending'",
      ),
      db.query(
        "SELECT COUNT(*) as open_complaints FROM complaints WHERE status IN ('open','in_progress')",
      ),
    ];

    const results = await Promise.all(queries);
    res.json({
      stats: {
        total_buses: parseInt(results[0].rows[0].total_buses),
        active_buses: parseInt(results[1].rows[0].active_buses),
        total_drivers: parseInt(results[2].rows[0].total_drivers),
        active_drivers: parseInt(results[3].rows[0].active_drivers),
        pending_requests: parseInt(results[4].rows[0].pending_requests),
        open_complaints: parseInt(results[5].rows[0].open_complaints),
      },
    });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
