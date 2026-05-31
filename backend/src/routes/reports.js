const express = require("express");
const db = require("../db");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const router = express.Router();

function handleExport(res, rows, filename, format) {
  // CSV Export
  if (format === "csv") {
    if (!rows || rows.length === 0) {
      res.header("Content-Type", "text/csv");
      res.attachment(`${filename}.csv`);
      return res.send("No data available for the selected period");
    }
    try {
      const parser = new Parser();
      const csv = parser.parse(rows);
      res.header("Content-Type", "text/csv");
      res.attachment(`${filename}.csv`);
      return res.send(csv);
    } catch (err) {
      console.error("CSV parse error:", err.message);
      res.header("Content-Type", "text/csv");
      res.attachment(`${filename}.csv`);
      return res.send("No data available");
    }
  }

  // PDF Export
  if (format === "pdf") {
    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}.pdf`,
    );
    doc.pipe(res);
    doc.fontSize(16).text(filename, { align: "center" });
    doc.moveDown();
    if (!rows || rows.length === 0) {
      doc.text("No data available for the selected period");
    } else {
      rows.forEach((row, i) => {
        doc.fontSize(10).text(JSON.stringify(row, null, 2));
        if (i < rows.length - 1) doc.moveDown(0.5);
      });
    }
    doc.end();
    return;
  }

  // ✅ FIXED: Use "report" key to match frontend expectation
  if (!rows || rows.length === 0) {
    return res.json({
      report: [],
      message: "No data available for the selected period",
    });
  }
  return res.json({ report: rows });
}

// TRIPS
router.get("/trips", async (req, res) => {
  try {
    const { from, to, route_id, format } = req.query;
    let query = `
      SELECT 
        t.trip_date::date as trip_date,
        r.name as route_name,
        b.registration_number as bus_number,
        u.full_name as driver_name,
        t.trip_type,
        t.status,
        COALESCE(t.delay_minutes, 0) as delay_minutes
      FROM trips t
      JOIN route_assignments ra ON t.assignment_id = ra.id
      JOIN routes r ON ra.route_id = r.rid
      JOIN buses b ON ra.bus_id = b.bid
      JOIN drivers d ON ra.driver_id = d.id
      JOIN users u ON d.userid = u.userid
      WHERE 1=1
    `;
    const params = [];
    if (from) {
      params.push(from);
      query += ` AND t.trip_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND t.trip_date <= $${params.length}`;
    }
    if (route_id) {
      params.push(route_id);
      query += ` AND r.rid = $${params.length}`;
    }
    query += ` ORDER BY t.trip_date DESC LIMIT 1000`;
    const { rows } = await db.query(query, params);
    handleExport(
      res,
      rows,
      `trips-report-${from || "all"}-to-${to || "all"}`,
      format,
    );
  } catch (err) {
    console.error("Trips error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELAYS
router.get("/delays", async (req, res) => {
  try {
    const { from, to, format } = req.query;
    const { rows } = await db.query(
      `
      SELECT 
        r.name as route_name,
        COUNT(*) as total_trips,
        ROUND(AVG(COALESCE(t.delay_minutes, 0)), 2) as avg_delay,
        MAX(COALESCE(t.delay_minutes, 0)) as max_delay,
        COUNT(CASE WHEN t.delay_minutes > 10 THEN 1 END) as delayed_trips
      FROM trips t
      JOIN route_assignments ra ON t.assignment_id = ra.id
      JOIN routes r ON ra.route_id = r.rid
      WHERE t.status = 'completed'
        AND ($1::date IS NULL OR t.trip_date >= $1)
        AND ($2::date IS NULL OR t.trip_date <= $2)
      GROUP BY r.name
      ORDER BY avg_delay DESC
    `,
      [from || null, to || null],
    );
    handleExport(res, rows, "delays-report", format);
  } catch (err) {
    console.error("Delays error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DRIVER HOURS
router.get("/driver-hours", async (req, res) => {
  const { from, to, period = "week", format } = req.query;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        u.userid as driver_id,
        u.full_name as driver_name,
        DATE_TRUNC($3, t.trip_date) as period_start,
        COUNT(t.id) as trips_count,
        ROUND(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/3600), 2) as total_hours
      FROM trips t
      JOIN route_assignments ra ON t.assignment_id = ra.id
      JOIN drivers d ON ra.driver_id = d.id
      JOIN users u ON d.userid = u.userid
      WHERE t.status = 'completed' AND t.end_time IS NOT NULL
        AND ($1::date IS NULL OR t.trip_date >= $1)
        AND ($2::date IS NULL OR t.trip_date <= $2)
      GROUP BY u.userid, u.full_name, DATE_TRUNC($3, t.trip_date)
      ORDER BY period_start DESC, total_hours DESC
    `,
      [from || null, to || null, period],
    );
    handleExport(res, rows, "driver-hours-report", format);
  } catch (err) {
    console.error("Driver hours error:", err);
    res.status(500).json({ error: err.message });
  }
});

// BUS UTILIZATION
router.get("/bus-utilization", async (req, res) => {
  const { from, to, format } = req.query;
  try {
    const { rows } = await db.query(
      `
      WITH date_range AS (
        SELECT 
          COALESCE($1::date, CURRENT_DATE - INTERVAL '30 days') as start_date,
          COALESCE($2::date, CURRENT_DATE) as end_date
      ),
      total_days AS (
        SELECT (DATE_PART('day', end_date - start_date) + 1)::int as days FROM date_range
      ),
      bus_hours AS (
        SELECT 
          b.bid,
          b.registration_number,
          b.capacity,
          COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/3600), 0) as scheduled_hours,
          COUNT(DISTINCT t.id) as trips_assigned
        FROM buses b
        LEFT JOIN route_assignments ra ON b.bid = ra.bus_id
        LEFT JOIN trips t ON ra.id = t.assignment_id 
          AND t.status = 'completed' AND t.end_time IS NOT NULL
          AND ($1::date IS NULL OR t.trip_date >= $1)
          AND ($2::date IS NULL OR t.trip_date <= $2)
        WHERE b.status = 'active'
        GROUP BY b.bid, b.registration_number, b.capacity
      )
      SELECT 
        *,
        ROUND((scheduled_hours / (24 * (SELECT days FROM total_days))) * 100, 2) as utilization_percent
      FROM bus_hours
      ORDER BY utilization_percent DESC
    `,
      [from || null, to || null],
    );
    handleExport(res, rows, "bus-utilization-report", format);
  } catch (err) {
    console.error("Bus utilization error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ON-TIME PERFORMANCE
router.get("/on-time-performance", async (req, res) => {
  const { from, to, route_id, format } = req.query;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        r.name as route_name,
        u.full_name as driver_name,
        COUNT(*) as total_trips,
        COUNT(CASE WHEN t.delay_minutes <= 5 THEN 1 END) as on_time_trips,
        COUNT(CASE WHEN t.delay_minutes > 5 AND t.delay_minutes <= 15 THEN 1 END) as minor_delay,
        COUNT(CASE WHEN t.delay_minutes > 15 THEN 1 END) as major_delay,
        ROUND(AVG(COALESCE(t.delay_minutes, 0)), 2) as avg_delay_minutes,
        ROUND((COUNT(CASE WHEN t.delay_minutes <= 5 THEN 1 END)::decimal / NULLIF(COUNT(*), 0)) * 100, 2) as on_time_percent
      FROM trips t
      JOIN route_assignments ra ON t.assignment_id = ra.id
      JOIN routes r ON ra.route_id = r.rid
      JOIN drivers d ON ra.driver_id = d.id
      JOIN users u ON d.userid = u.userid
      WHERE t.status = 'completed'
        AND ($1::date IS NULL OR t.trip_date >= $1)
        AND ($2::date IS NULL OR t.trip_date <= $2)
        AND ($3::uuid IS NULL OR r.rid = $3)
      GROUP BY r.name, u.full_name
      ORDER BY on_time_percent ASC
    `,
      [from || null, to || null, route_id || null],
    );
    handleExport(res, rows, "on-time-performance-report", format);
  } catch (err) {
    console.error("On-time performance error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ROUTE EFFICIENCY
router.get("/route-efficiency", async (req, res) => {
  const { from, to, format } = req.query;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        r.rid,
        r.name as route_name,
        r.total_distance_km as distance_km,
        COUNT(DISTINCT t.id) as total_trips,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60), 2) as avg_trip_mins
      FROM routes r
      LEFT JOIN route_assignments ra ON r.rid = ra.route_id
      LEFT JOIN trips t ON ra.id = t.assignment_id 
        AND t.status = 'completed' AND t.end_time IS NOT NULL
        AND ($1::date IS NULL OR t.trip_date >= $1)
        AND ($2::date IS NULL OR t.trip_date <= $2)
      WHERE r.is_active = true
      GROUP BY r.rid, r.name, r.total_distance_km
      ORDER BY total_trips DESC
    `,
      [from || null, to || null],
    );
    handleExport(res, rows, "route-efficiency-report", format);
  } catch (err) {
    console.error("Route efficiency error:", err);
    res.status(500).json({ error: err.message });
  }
});

// STUDENT LOAD
router.get("/student-load", async (req, res) => {
  const { route_id, format } = req.query;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        r.name as route_name,
        st.name as stop_name,
        st.sequence_number as stop_order,
        COUNT(DISTINCT s.sid) as students_assigned
      FROM routes r
      LEFT JOIN stops st ON st.route_id = r.rid
      LEFT JOIN students s ON s.assigned_stop_id = st.id
      WHERE ($1::uuid IS NULL OR r.rid = $1)
      GROUP BY r.rid, r.name, st.id, st.name, st.sequence_number
      ORDER BY r.name, st.sequence_number
    `,
      [route_id || null],
    );
    handleExport(res, rows, "student-load-report", format);
  } catch (err) {
    console.error("Student load error:", err);
    res.status(500).json({ error: err.message });
  }
});

// COMPLAINTS SUMMARY
router.get("/complaints-summary", async (req, res) => {
  const { from, to, format } = req.query;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        c.category,
        c.priority,
        c.status,
        COUNT(*) as total_count,
        COUNT(CASE WHEN c.status = 'resolved' THEN 1 END) as resolved_count,
        ROUND(AVG(
          CASE WHEN c.status = 'resolved' AND c.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/3600 
          END
        ), 2) as avg_resolution_hours,
        COUNT(CASE WHEN c.status = 'open' AND c.created_at < NOW() - INTERVAL '7 days' THEN 1 END) as overdue_count
      FROM complaints c
      WHERE ($1::date IS NULL OR c.created_at >= $1)
        AND ($2::date IS NULL OR c.created_at <= $2)
      GROUP BY c.category, c.priority, c.status
      ORDER BY total_count DESC
    `,
      [from || null, to || null],
    );
    handleExport(res, rows, "complaints-summary-report", format);
  } catch (err) {
    console.error("Complaints summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
