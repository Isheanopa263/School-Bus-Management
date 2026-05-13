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

/**
 * POST /api/driver/trips/start
 * Creates a new trip record and marks it as ongoing
 */
router.post(
  "/trips/start",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const userId = req.user.userid;
    const { trip_type } = req.body;

    if (!trip_type || !["pickup", "drop"].includes(trip_type)) {
      return res
        .status(400)
        .json({ error: "trip_type must be 'pickup' or 'drop'" });
    }

    try {
      // Get driver id
      const driverResult = await db.query(
        `SELECT id FROM drivers WHERE userid = $1`,
        [userId],
      );

      if (driverResult.rows.length === 0) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const driverId = driverResult.rows[0].id;
      const today = new Date().toISOString().split("T")[0];

      // Get today's assignment
      const assignmentResult = await db.query(
        `SELECT id FROM route_assignments
         WHERE driver_id = $1
           AND effective_date <= $2
           AND (end_date IS NULL OR end_date >= $2)
         ORDER BY effective_date DESC
         LIMIT 1`,
        [driverId, today],
      );

      if (assignmentResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "No route assignment found for today" });
      }

      const assignmentId = assignmentResult.rows[0].id;

      // Check if a trip is already ongoing
      const ongoingResult = await db.query(
        `SELECT id FROM trips
         WHERE assignment_id = $1
           AND trip_date = $2
           AND status = 'ongoing'`,
        [assignmentId, today],
      );

      if (ongoingResult.rows.length > 0) {
        return res.status(409).json({
          error: "A trip is already ongoing",
          trip_id: ongoingResult.rows[0].id,
        });
      }

      // Create new trip
      const tripResult = await db.query(
        `INSERT INTO trips 
          (assignment_id, trip_date, trip_type, start_time, status)
         VALUES ($1, $2, $3, NOW(), 'ongoing')
         RETURNING id, assignment_id, trip_date, trip_type, 
                   start_time, status`,
        [assignmentId, today, trip_type],
      );

      res.status(201).json({ trip: tripResult.rows[0] });
    } catch (err) {
      console.error("Start trip error:", err);
      res.status(500).json({ error: "Failed to start trip" });
    }
  },
);

/**
 * POST /api/driver/trips/:id/end
 * Marks an ongoing trip as completed
 */
router.post(
  "/trips/:id/end",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const userId = req.user.userid;
    const { id } = req.params;

    try {
      // Verify this trip belongs to this driver
      const verifyResult = await db.query(
        `SELECT t.id, t.status, t.start_time, ra.driver_id
         FROM trips t
         JOIN route_assignments ra ON ra.id = t.assignment_id
         JOIN drivers d ON d.id = ra.driver_id
         WHERE t.id = $1
           AND d.userid = $2`,
        [id, userId],
      );

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const trip = verifyResult.rows[0];

      if (trip.status !== "ongoing") {
        return res.status(400).json({
          error: `Trip is already ${trip.status}`,
        });
      }

      // Calculate delay (difference between actual end and expected)
      // For now we store 0, can be enhanced with schedule comparison
      const tripResult = await db.query(
        `UPDATE trips
         SET status       = 'completed',
             end_time     = NOW(),
             delay_minutes = EXTRACT(
               EPOCH FROM (NOW() - start_time)
             )::INT / 60
         WHERE id = $1
         RETURNING id, trip_type, trip_date, start_time, 
                   end_time, status, delay_minutes`,
        [id],
      );

      res.json({ trip: tripResult.rows[0] });
    } catch (err) {
      console.error("End trip error:", err);
      res.status(500).json({ error: "Failed to end trip" });
    }
  },
);

/**
 * POST /api/driver/location/update
 * Receives GPS coordinates from driver app during active trip
 */
router.post(
  "/location/update",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const userId = req.user.userid;
    const { trip_id, latitude, longitude, speed, heading } = req.body;

    // Validate
    if (!trip_id || latitude == null || longitude == null) {
      return res.status(400).json({
        error: "trip_id, latitude, and longitude are required",
      });
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    try {
      // Verify trip belongs to this driver and is ongoing
      const verifyResult = await db.query(
        `SELECT t.id, t.status, ra.bus_id
         FROM trips t
         JOIN route_assignments ra ON ra.id = t.assignment_id
         JOIN drivers d ON d.id = ra.driver_id
         WHERE t.id = $1
           AND d.userid = $2`,
        [trip_id, userId],
      );

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const trip = verifyResult.rows[0];

      if (trip.status !== "ongoing") {
        return res.status(400).json({ error: "Trip is not active" });
      }

      const busId = trip.bus_id;

      // Insert into live_locations
      await db.query(
        `INSERT INTO live_locations 
          (bus_id, trip_id, location, speed_kmh, heading, recorded_at)
         VALUES (
           $1, $2,
           ST_SetSRID(ST_MakePoint($3, $4), 4326),
           $5, $6, NOW()
         )`,
        [busId, trip_id, longitude, latitude, speed || 0, heading || 0],
      );

      // Also try to publish via Redis for real-time (fails silently if no Redis)
      try {
        const {
          cacheLatestLocation,
          publishLocation,
        } = require("../services/redis");

        const locationData = {
          bus_id: busId,
          trip_id,
          latitude,
          longitude,
          speed: speed || 0,
          heading: heading || 0,
          timestamp: new Date().toISOString(),
        };

        await cacheLatestLocation(busId, locationData);
        await publishLocation(busId, locationData);
      } catch (redisErr) {
        // Redis not available - location still saved to DB
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("Location update error:", err);
      res.status(500).json({ error: "Failed to update location" });
    }
  },
);

/**
 * GET /api/driver/location/history/:tripId
 * Returns location history for a specific trip
 */
router.get(
  "/location/history/:tripId",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const userId = req.user.userid;
    const { tripId } = req.params;

    try {
      // Verify trip belongs to this driver
      const verifyResult = await db.query(
        `SELECT t.id
         FROM trips t
         JOIN route_assignments ra ON ra.id = t.assignment_id
         JOIN drivers d ON d.id = ra.driver_id
         WHERE t.id = $1
           AND d.userid = $2`,
        [tripId, userId],
      );

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const { rows } = await db.query(
        `SELECT 
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          speed_kmh,
          heading,
          recorded_at
         FROM live_locations
         WHERE trip_id = $1
         ORDER BY recorded_at ASC`,
        [tripId],
      );

      res.json({
        trip_id: tripId,
        total_points: rows.length,
        locations: rows,
      });
    } catch (err) {
      console.error("Location history error:", err);
      res.status(500).json({ error: "Failed to fetch location history" });
    }
  },
);

/**
 * POST /api/driver/sos
 * Creates an SOS/breakdown event during an active trip
 */
router.post("/sos", requireAuth, requireRole(["driver"]), async (req, res) => {
  const userId = req.user.userid;
  const { event_type, severity, details, latitude, longitude } = req.body;

  // Validate event type
  const allowedTypes = [
    "breakdown",
    "sos",
    "overspeeding",
    "route_deviation",
    "harsh_braking",
  ];

  if (!event_type || !allowedTypes.includes(event_type)) {
    return res.status(400).json({
      error: `event_type must be one of: ${allowedTypes.join(", ")}`,
    });
  }

  const validSeverities = ["low", "medium", "high"];
  const finalSeverity = validSeverities.includes(severity) ? severity : "high";

  try {
    // Get driver info
    const driverResult = await db.query(
      `SELECT d.id AS driver_id, d.current_bus_id
         FROM drivers d
         WHERE d.userid = $1`,
      [userId],
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const driver = driverResult.rows[0];
    const driverId = driver.driver_id;
    const busId = driver.current_bus_id;
    const today = new Date().toISOString().split("T")[0];

    // Find active trip (optional - SOS can work without active trip)
    const tripResult = await db.query(
      `SELECT t.id
         FROM trips t
         JOIN route_assignments ra ON ra.id = t.assignment_id
         WHERE ra.driver_id = $1
           AND t.trip_date = $2
           AND t.status = 'ongoing'
         ORDER BY t.start_time DESC
         LIMIT 1`,
      [driverId, today],
    );

    const tripId = tripResult.rows.length > 0 ? tripResult.rows[0].id : null;

    // Build location if provided
    let locationQuery = "NULL";
    const queryParams = [
      tripId,
      busId,
      event_type,
      finalSeverity,
      details ? JSON.stringify(details) : null,
    ];

    if (latitude != null && longitude != null) {
      queryParams.push(longitude, latitude);
      locationQuery = `ST_SetSRID(ST_MakePoint($${queryParams.length - 1}, $${queryParams.length}), 4326)`;
    }

    // Insert trip event
    const eventResult = await db.query(
      `INSERT INTO trip_events
          (trip_id, bus_id, event_type, severity, location, details, occurred_at)
         VALUES ($1, $2, $3, $4, ${locationQuery}, $5, NOW())
         RETURNING id, trip_id, bus_id, event_type, severity, details, occurred_at`,
      queryParams,
    );

    const event = eventResult.rows[0];

    // Also create a complaint record for admin tracking
    await db.query(
      `INSERT INTO complaints
          (raised_by, trip_id, driver_id, bus_id, category, description, 
           status, priority, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())`,
      [
        userId,
        tripId,
        driverId,
        busId,
        event_type,
        details?.description ||
          `${event_type.toUpperCase()} reported by driver`,
        finalSeverity === "high" ? "high" : "medium",
      ],
    );

    console.log(
      `🚨 SOS ALERT: ${event_type} from driver ${userId} at ${new Date().toISOString()}`,
    );

    res.status(201).json({
      event,
      message: "SOS alert sent successfully. Admin has been notified.",
    });
  } catch (err) {
    console.error("SOS error:", err);
    res.status(500).json({ error: "Failed to send SOS alert" });
  }
});

/**
 * GET /api/driver/sos/history
 * Returns SOS/event history for the driver
 */
router.get(
  "/sos/history",
  requireAuth,
  requireRole(["driver"]),
  async (req, res) => {
    const userId = req.user.userid;

    try {
      const driverResult = await db.query(
        `SELECT id FROM drivers WHERE userid = $1`,
        [userId],
      );

      if (driverResult.rows.length === 0) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const driverId = driverResult.rows[0].id;

      const { rows } = await db.query(
        `SELECT 
    te.id, te.event_type, te.severity, te.details,
    te.occurred_at,
    ST_Y(te.location::geometry) AS latitude,
    ST_X(te.location::geometry) AS longitude,
    t.trip_date, t.trip_type
   FROM trip_events te
   LEFT JOIN trips t ON t.id = te.trip_id
   LEFT JOIN route_assignments ra ON ra.id = t.assignment_id
   WHERE (ra.driver_id = $1 OR te.bus_id = (
     SELECT current_bus_id FROM drivers WHERE id = $1
   ))
   ORDER BY te.occurred_at DESC
   LIMIT 20`,
        [driverId],
      );

      res.json({ events: rows });
    } catch (err) {
      console.error("SOS history error:", err);
      res.status(500).json({ error: "Failed to fetch SOS history" });
    }
  },
);

module.exports = router;
