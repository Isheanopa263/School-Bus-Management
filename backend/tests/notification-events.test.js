const request = require("supertest");
const { app } = require("../src/app");
const {
  cleanDatabase,
  createTestBus,
  createTestRoute,
  createTestStop,
  createTestAssignment,
  closePool,
} = require("./helpers/db");
const { createAdmin, createDriver, createStudent } = require("./helpers/auth");
const db = require("../src/db");

describe("Notification Events", () => {
  afterAll(async () => await closePool());

  describe("SOS creates notification for admins", () => {
    it("creates notification record when driver sends SOS", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const driver = await createDriver();
      const bus = await createTestBus();
      const route = await createTestRoute();

      await request(app)
        .put(`/api/drivers/${driver.driver.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          current_bus_id: bus.bid,
          license_number: driver.driver.license_number,
          license_expiry: "2027-12-31",
        });

      await createTestAssignment(route.rid, bus.bid, driver.driver.id);

      // Start trip
      await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });

      // Send SOS
      const sosRes = await request(app)
        .post("/api/driver/sos")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          event_type: "breakdown",
          severity: "high",
          details: { description: "Engine failure" },
        });

      expect(sosRes.status).toBe(201);
      expect(sosRes.body.event).toBeDefined();

      // Check notification was created for admin
      const notifResult = await db.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 1",
        [admin.user.userid],
      );

      expect(notifResult.rows.length).toBeGreaterThan(0);
      expect(notifResult.rows[0].title).toContain("BREAKDOWN");
    });
  });

  describe("Bus request creates notification for admins", () => {
    it("creates notification when student submits request", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const student = await createStudent();
      const driver = await createDriver();
      const bus = await createTestBus();
      const route = await createTestRoute();
      await createTestStop(route.rid, 1);
      await createTestAssignment(route.rid, bus.bid, driver.driver.id);

      const reqRes = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });

      expect(reqRes.status).toBe(201);

      // Check notification created for admin
      const notifResult = await db.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 1",
        [admin.user.userid],
      );

      expect(notifResult.rows.length).toBeGreaterThan(0);
      expect(notifResult.rows[0].title).toContain("Bus Request");
    });
  });

  describe("Student complaint creates notification for admins", () => {
    it("creates notification when student submits complaint", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const student = await createStudent();

      const complaintRes = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({
          category: "bus_service",
          description: "Bus was very late today",
          priority: "high",
        });

      expect(complaintRes.status).toBe(201);

      // Check notification created for admin
      const notifResult = await db.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 1",
        [admin.user.userid],
      );

      expect(notifResult.rows.length).toBeGreaterThan(0);
      expect(notifResult.rows[0].title).toContain("Complaint");
    });
  });

  describe("Stop skip creates notification for students", () => {
    it("notifies students when their stop is skipped", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const driver = await createDriver();
      const student = await createStudent();
      const bus = await createTestBus();
      const route = await createTestRoute();
      const stop = await createTestStop(route.rid, 1);

      // Assign student to stop
      await db.query(
        "UPDATE students SET assigned_stop_id = $1, bus_request_status = 'approved' WHERE sid = $2",
        [stop.id, student.student.sid],
      );

      await request(app)
        .put(`/api/drivers/${driver.driver.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          current_bus_id: bus.bid,
          license_number: driver.driver.license_number,
          license_expiry: "2027-12-31",
        });

      const assignment = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );

      // Start trip
      const tripRes = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });
      const tripId = tripRes.body.trip.id;

      // Skip the stop
      const skipRes = await request(app)
        .post("/api/driver/stops/skip")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          stop_id: stop.id,
          reason: "Road flooded",
        });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.students_notified).toBeGreaterThanOrEqual(1);

      // Check notification for student
      const notifResult = await db.query(
        "SELECT * FROM notifications WHERE user_id = $1 AND type = 'stop_skipped' ORDER BY sent_at DESC LIMIT 1",
        [student.user.userid],
      );

      expect(notifResult.rows.length).toBeGreaterThan(0);
      expect(notifResult.rows[0].message).toContain("skipped");
      expect(notifResult.rows[0].message).toContain("Road flooded");
    });
  });

  describe("FCM token management", () => {
    it("saves token to database", async () => {
      await cleanDatabase();
      const student = await createStudent();

      await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ fcm_token: "test_token_abc123" });

      // Verify in database
      const result = await db.query(
        "SELECT fcm_token FROM users WHERE userid = $1",
        [student.user.userid],
      );

      expect(result.rows[0].fcm_token).toBe("test_token_abc123");
    });

    it("updates existing token", async () => {
      await cleanDatabase();
      const student = await createStudent();

      // Save first token
      await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ fcm_token: "old_token" });

      // Update with new token
      await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ fcm_token: "new_token" });

      const result = await db.query(
        "SELECT fcm_token FROM users WHERE userid = $1",
        [student.user.userid],
      );

      expect(result.rows[0].fcm_token).toBe("new_token");
    });

    it("different users have different tokens", async () => {
      await cleanDatabase();
      const student1 = await createStudent();
      const student2 = await createStudent();

      await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${student1.token}`)
        .send({ fcm_token: "token_student_1" });

      await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${student2.token}`)
        .send({ fcm_token: "token_student_2" });

      const r1 = await db.query(
        "SELECT fcm_token FROM users WHERE userid = $1",
        [student1.user.userid],
      );
      const r2 = await db.query(
        "SELECT fcm_token FROM users WHERE userid = $1",
        [student2.user.userid],
      );

      expect(r1.rows[0].fcm_token).toBe("token_student_1");
      expect(r2.rows[0].fcm_token).toBe("token_student_2");
    });
  });
});
