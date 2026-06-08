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

describe("Attendance System", () => {
  let admin, driver, student, bus, route, stop, assignment, tripId;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    driver = await createDriver();
    student = await createStudent();
    bus = await createTestBus();
    route = await createTestRoute();
    stop = await createTestStop(route.rid, 1);

    // Assign bus to driver
    await request(app)
      .put(`/api/drivers/${driver.driver.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        current_bus_id: bus.bid,
        license_number: driver.driver.license_number,
        license_expiry: "2027-12-31",
      });

    assignment = await createTestAssignment(
      route.rid,
      bus.bid,
      driver.driver.id,
    );

    // Assign student to stop
    await db.query(
      "UPDATE students SET assigned_stop_id = $1, bus_request_status = 'approved' WHERE sid = $2",
      [stop.id, student.student.sid],
    );

    // Start a trip
    const tripRes = await request(app)
      .post("/api/driver/trips/start")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ trip_type: "pickup" });
    tripId = tripRes.body.trip.id;

    // Send GPS near the stop so proximity check passes
    await request(app)
      .post("/api/driver/location/update")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({
        trip_id: tripId,
        latitude: parseFloat(stop.latitude),
        longitude: parseFloat(stop.longitude),
        speed: 0,
        heading: 0,
      });
  });

  afterAll(async () => await closePool());

  describe("POST /api/driver/attendance", () => {
    it("marks student as picked up", async () => {
      const res = await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });
      expect(res.status).toBe(201);
      expect(res.body.attendance).toBeDefined();
      expect(res.body.message).toContain("marked");
    });

    it("returns 400 without required fields", async () => {
      const res = await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid event_type", async () => {
      const res = await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "invalid",
        });
      expect(res.status).toBe(400);
    });

    it("allows re-marking same student (upsert)", async () => {
      // Mark first time
      await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });

      // Mark again - should update timestamp
      const res = await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });
      expect(res.status).toBe(201);
    });

    it("returns 403 for admin role", async () => {
      const res = await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/driver/attendance/:tripId", () => {
    it("returns empty attendance for new trip", async () => {
      const res = await request(app)
        .get(`/api/driver/attendance/${tripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance).toBeDefined();
      expect(Array.isArray(res.body.attendance)).toBe(true);
    });

    it("returns marked students after attendance", async () => {
      await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });

      const res = await request(app)
        .get(`/api/driver/attendance/${tripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance.length).toBe(1);
    });

    it("returns 404 for non-existent trip", async () => {
      const res = await request(app)
        .get("/api/driver/attendance/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/driver/attendance/:id", () => {
    it("unmarks attendance", async () => {
      const markRes = await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });

      const attendanceId = markRes.body.attendance.id;
      const res = await request(app)
        .delete(`/api/driver/attendance/${attendanceId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent record", async () => {
      const res = await request(app)
        .delete("/api/driver/attendance/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/student/attendance", () => {
    it("returns student attendance history", async () => {
      // Mark attendance first
      await request(app)
        .post("/api/driver/attendance")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          student_id: student.student.sid,
          stop_id: stop.id,
          event_type: "pickup",
        });

      const res = await request(app)
        .get("/api/student/attendance")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance.length).toBeGreaterThan(0);
    });

    it("returns empty for student with no attendance", async () => {
      const newStudent = await createStudent();
      const res = await request(app)
        .get("/api/student/attendance")
        .set("Authorization", `Bearer ${newStudent.token}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance.length).toBe(0);
    });

    it("returns 403 for driver role", async () => {
      const res = await request(app)
        .get("/api/student/attendance")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(403);
    });
  });
});
