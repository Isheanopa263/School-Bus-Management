const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");

const router = express.Router();

/**
 * GET /api/reports/trips - Trip summary report
 * Query: ?from=2026-01-01&to=2026-01-31&route_id=UUID&format=csv
 */
router.get("/trips", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { from, to, route_id, format = "json" } = req.query;

  try {
    let query = `
      SELECT 
        t.id as trip_id,
        t.trip_date,
        t.trip_type,
        t.status,
        t.start_time,
        t.end_time,
        t.delay_minutes,
        r.name as route_name,
        b.registration_number as bus_number,
        u.full_name as driver_name,
        COUNT(te.id) as event_count
      FROM trips t
      JOIN route_assignments ra ON t.assignment_id = ra.id
      JOIN routes r ON ra.route_id = r.rid
      JOIN buses b ON ra.bus_id = b.bid
      JOIN drivers d ON ra.driver_id = d.id
      JOIN users u ON d.userid = u.userid
      LEFT JOIN trip_events te ON t.id = te.trip_id
    `;
    const params = [];
    const conditions = [];

    if (from) {
      conditions.push(`t.trip_date >= $${params.length + 1}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`t.trip_date <= $${params.length + 1}`);
      params.push(to);
    }
    if (route_id) {
      conditions.push(`r.rid = $${params.length + 1}`);
      params.push(route_id);
    }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query +=
      " GROUP BY t.id, r.name, b.registration_number, u.full_name ORDER BY t.trip_date DESC";

    const { rows } = await db.query(query, params);

    if (format === "csv") {
      const parser = new Parser();
      const csv = parser.parse(rows);
      res.header("Content-Type", "text/csv");
      res.attachment("trips_report.csv");
      return res.send(csv);
    }

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=trips_report.pdf",
      );
      doc.pipe(res);

      doc.fontSize(18).text("Trip Summary Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(10).text(`Period: ${from || "All"} to ${to || "All"}`);
      doc.moveDown();

      rows.forEach((t) => {
        doc
          .fontSize(12)
          .text(`${t.trip_date} - ${t.route_name} - ${t.trip_type}`);
        doc
          .fontSize(9)
          .text(
            `Bus: ${t.bus_number} | Driver: ${t.driver_name} | Status: ${t.status}`,
          );
        doc.text(
          `Delay: ${t.delay_minutes || 0} min | Events: ${t.event_count}`,
        );
        doc.moveDown(0.5);
      });

      doc.end();
      return;
    }

    res.json({ report: rows, count: rows.length });
  } catch (err) {
    console.error("Trips report error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

/**
 * GET /api/reports/delays - Delay analysis
 */
router.get("/delays", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { from, to, format = "json" } = req.query;

  try {
    const { rows } = await db.query(
      `SELECT 
        r.name as route_name,
        COUNT(*) as total_trips,
        AVG(t.delay_minutes) as avg_delay,
        MAX(t.delay_minutes) as max_delay,
        COUNT(CASE WHEN t.delay_minutes > 10 THEN 1 END) as delayed_trips
       FROM trips t
       JOIN route_assignments ra ON t.assignment_id = ra.id
       JOIN routes r ON ra.route_id = r.rid
       WHERE ($1::date IS NULL OR t.trip_date >= $1)
         AND ($2::date IS NULL OR t.trip_date <= $2)
         AND t.status = 'completed'
       GROUP BY r.name
       ORDER BY avg_delay DESC`,
      [from || null, to || null],
    );

    if (format === "csv") {
      const parser = new Parser();
      const csv = parser.parse(rows);
      res.header("Content-Type", "text/csv");
      res.attachment("delays_report.csv");
      return res.send(csv);
    }

    res.json({ report: rows });
  } catch (err) {
    console.error("Delays report error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

/**
 * GET /api/reports/tickets - Ticket summary
 */
router.get(
  "/tickets",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { from, to, status, format = "json" } = req.query;

    try {
      let query = `
      SELECT 
        t.id,
        t.category,
        t.priority,
        t.status,
        t.created_at,
        t.resolved_at,
        u.full_name as raised_by,
        r.name as route_name
      FROM tickets t
      JOIN users u ON t.raised_by = u.userid
      LEFT JOIN trips trip ON t.trip_id = trip.id
      LEFT JOIN route_assignments ra ON trip.assignment_id = ra.id
      LEFT JOIN routes r ON ra.route_id = r.rid
    `;
      const params = [];
      const conditions = [];

      if (from) {
        conditions.push(`t.created_at >= $${params.length + 1}`);
        params.push(from);
      }
      if (to) {
        conditions.push(`t.created_at <= $${params.length + 1}`);
        params.push(to);
      }
      if (status) {
        conditions.push(`t.status = $${params.length + 1}`);
        params.push(status);
      }

      if (conditions.length) query += " WHERE " + conditions.join(" AND ");
      query += " ORDER BY t.created_at DESC";

      const { rows } = await db.query(query, params);

      if (format === "csv") {
        const parser = new Parser();
        const csv = parser.parse(rows);
        res.header("Content-Type", "text/csv");
        res.attachment("tickets_report.csv");
        return res.send(csv);
      }

      res.json({ report: rows, count: rows.length });
    } catch (err) {
      console.error("Tickets report error:", err);
      res.status(500).json({ error: "Failed to generate report" });
    }
  },
);

/**
 * GET /api/reports/attendance - Student attendance per route
 * Based on bus_requests status
 */
router.get(
  "/attendance",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { from, to, route_id, format = "json" } = req.query;

    try {
      const { rows } = await db.query(
        `SELECT 
        r.name as route_name,
        COUNT(DISTINCT s.sid) as total_students,
        COUNT(DISTINCT CASE WHEN br.status = 'approved' THEN s.sid END) as approved_students,
        COUNT(DISTINCT CASE WHEN br.status = 'pending' THEN s.sid END) as pending_requests
       FROM routes r
       LEFT JOIN stops st ON st.route_id = r.rid
       LEFT JOIN students s ON s.assigned_stop_id = st.id
       LEFT JOIN bus_requests br ON br.student_id = s.sid
         AND ($1::date IS NULL OR br.created_at >= $1)
         AND ($2::date IS NULL OR br.created_at <= $2)
       WHERE ($3::uuid IS NULL OR r.rid = $3)
       GROUP BY r.rid, r.name
       ORDER BY r.name`,
        [from || null, to || null, route_id || null],
      );

      if (format === "csv") {
        const parser = new Parser();
        const csv = parser.parse(rows);
        res.header("Content-Type", "text/csv");
        res.attachment("attendance_report.csv");
        return res.send(csv);
      }

      res.json({ report: rows });
    } catch (err) {
      console.error("Attendance report error:", err);
      res.status(500).json({ error: "Failed to generate report" });
    }
  },
);

/**
 * GET /api/reports/gps-trail/:trip_id - Export GPS trail as CSV
 */
router.get(
  "/gps-trail/:trip_id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT 
        recorded_at,
        ST_Y(location) as latitude,
        ST_X(location) as longitude,
        speed_kmh,
        heading
       FROM live_locations
       WHERE trip_id = $1
       ORDER BY recorded_at ASC`,
        [req.params.trip_id],
      );

      const parser = new Parser();
      const csv = parser.parse(rows);
      res.header("Content-Type", "text/csv");
      res.attachment(`gps_trail_${req.params.trip_id}.csv`);
      res.send(csv);
    } catch (err) {
      console.error("GPS trail report error:", err);
      res.status(500).json({ error: "Failed to generate report" });
    }
  },
);

module.exports = router;
