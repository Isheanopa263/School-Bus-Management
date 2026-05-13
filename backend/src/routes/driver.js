const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { comparePassword } = require("../utils/hash");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/driver/login
 * Driver-specific login - returns JWT + driver profile
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    // Get user + driver record in one query
    const { rows } = await db.query(
      `SELECT 
        u.userid,
        u.role,
        u.full_name,
        u.email,
        u.phone,
        u.password_hash,
        u.is_active,
        d.id         AS driver_id,
        d.license_number,
        d.license_expiry,
        d.employment_status,
        d.current_bus_id,
        b.registration_number AS bus_number
       FROM users u
       JOIN drivers d ON d.userid = u.userid
       LEFT JOIN buses b ON b.bid = d.current_bus_id
       WHERE u.email = $1`,
      [email],
    );

    // User not found
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const driver = rows[0];

    // Must be driver role
    if (driver.role !== "driver") {
      return res.status(403).json({ error: "Access restricted to drivers" });
    }

    // Account active check
    if (!driver.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    // Employment status check
    if (driver.employment_status !== "active") {
      return res.status(403).json({
        error: `Driver account is ${driver.employment_status}`,
      });
    }

    // Password check
    const valid = await comparePassword(password, driver.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Sign JWT - include driver_id in payload (needed for all driver routes)
    const token = jwt.sign(
      {
        userid: driver.userid,
        driver_id: driver.driver_id,
        role: driver.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.json({
      token,
      driver: {
        userid: driver.userid,
        driver_id: driver.driver_id,
        full_name: driver.full_name,
        email: driver.email,
        phone: driver.phone,
        license_number: driver.license_number,
        license_expiry: driver.license_expiry,
        employment_status: driver.employment_status,
        current_bus_id: driver.current_bus_id,
        bus_number: driver.bus_number,
      },
    });
  } catch (err) {
    console.error("Driver login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/driver/route/today
 * Returns today's assignment, stops, and students for the driver
 */
router.get(
  "/route/today",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const userId = req.user.userid;

    try {
      // Step 1: Get driver_id from userid
      const driverResult = await db.query(
        `SELECT id, current_bus_id FROM drivers WHERE userid = $1`,
        [userId],
      );

      if (driverResult.rows.length === 0) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const driverId = driverResult.rows[0].id;
      const today = new Date().toISOString().split("T")[0];

      // Step 2: Get today's route assignment
      const assignmentResult = await db.query(
        `SELECT 
          ra.id           AS assignment_id,
          ra.route_id,
          ra.bus_id,
          ra.shift,
          ra.effective_date,
          r.name          AS route_name,
          r.total_distance_km,
          r.estimated_duration_min,
          b.registration_number AS bus_number,
          b.capacity
         FROM route_assignments ra
         JOIN routes r ON r.rid = ra.route_id
         JOIN buses  b ON b.bid = ra.bus_id
         WHERE ra.driver_id = $1
           AND ra.effective_date <= $2
           AND (ra.end_date IS NULL OR ra.end_date >= $2)
         ORDER BY ra.effective_date DESC
         LIMIT 1`,
        [driverId, today],
      );

      if (assignmentResult.rows.length === 0) {
        return res.status(404).json({
          error: "No route assigned for today",
        });
      }

      const assignment = assignmentResult.rows[0];

      // Step 3: Get all stops for this route (ordered by sequence)
      const stopsResult = await db.query(
        `SELECT 
          s.id,
          s.name,
          s.sequence_number,
          s.scheduled_arrival_time,
          ST_X(s.location::geometry) AS longitude,
          ST_Y(s.location::geometry) AS latitude
         FROM stops s
         WHERE s.route_id = $1
         ORDER BY s.sequence_number ASC`,
        [assignment.route_id],
      );

      // Step 4: Get students for each stop
      const studentsResult = await db.query(
        `SELECT 
          st.sid,
          st.assigned_stop_id,
          st.roll,
          st.emergency_contact_phone,
          u.full_name,
          u.phone
         FROM students st
         JOIN users u ON u.userid = st.userid
         WHERE st.assigned_stop_id = ANY(
           SELECT id FROM stops WHERE route_id = $1
         )
         AND st.bus_request_status = 'approved'
         ORDER BY st.assigned_stop_id, u.full_name`,
        [assignment.route_id],
      );

      // Step 5: Check if a trip already exists for today
      const tripResult = await db.query(
        `SELECT id, status, trip_type, start_time, end_time
         FROM trips
         WHERE assignment_id = $1
           AND trip_date = $2
         ORDER BY start_time DESC
         LIMIT 1`,
        [assignment.assignment_id, today],
      );

      // Step 6: Attach students to their stops
      const studentsMap = {};
      studentsResult.rows.forEach((student) => {
        const stopId = student.assigned_stop_id;
        if (!studentsMap[stopId]) {
          studentsMap[stopId] = [];
        }
        studentsMap[stopId].push({
          sid: student.sid,
          full_name: student.full_name,
          roll: student.roll,
          phone: student.phone,
          emergency_contact_phone: student.emergency_contact_phone,
        });
      });

      const stopsWithStudents = stopsResult.rows.map((stop) => ({
        ...stop,
        students: studentsMap[stop.id] || [],
      }));

      res.json({
        assignment: {
          assignment_id: assignment.assignment_id,
          route_id: assignment.route_id,
          route_name: assignment.route_name,
          shift: assignment.shift,
          total_distance_km: assignment.total_distance_km,
          estimated_duration_min: assignment.estimated_duration_min,
          bus_id: assignment.bus_id,
          bus_number: assignment.bus_number,
          bus_capacity: assignment.capacity,
        },
        stops: stopsWithStudents,
        total_stops: stopsResult.rows.length,
        total_students: studentsResult.rows.length,
        active_trip: tripResult.rows[0] || null,
      });
    } catch (err) {
      console.error("Get today route error:", err);
      res.status(500).json({ error: "Failed to fetch today's route" });
    }
  },
);

module.exports = router;
