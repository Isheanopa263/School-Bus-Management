const { createAdmin, createStudent, createDriver } = require("./helpers/auth");
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
const db = require("../src/db");

describe("Student API", () => {
  let student, admin;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    student = await createStudent();
  });

  afterAll(async () => await closePool());

  describe("GET /api/student/profile", () => {
    it("returns full student profile", async () => {
      const res = await request(app)
        .get("/api/student/profile")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
      expect(res.body.profile.full_name).toBeDefined();
      expect(res.body.profile.bus_request_status).toBe("inactive");
      expect(res.body.profile.sid).toBeDefined();
    });

    it("returns 403 for admin", async () => {
      const res = await request(app)
        .get("/api/student/profile")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/student/profile", () => {
    it("updates full_name and phone", async () => {
      const res = await request(app)
        .put("/api/student/profile")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ full_name: "Updated Name", phone: student.user.phone });
      expect(res.status).toBe(200);
    });

    it("updates emergency contact", async () => {
      const res = await request(app)
        .put("/api/student/profile")
        .set("Authorization", `Bearer ${student.token}`)
        .send({
          emergency_contact_phone: "9888888888",
          phone: student.user.phone,
        });
      expect(res.status).toBe(200);
    });

    it("updates roll number", async () => {
      const res = await request(app)
        .put("/api/student/profile")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ roll: "22A999", phone: student.user.phone });
      expect(res.status).toBe(200);
    });
  });

  describe("PUT /api/student/change-password", () => {
    it("changes password with correct current", async () => {
      const res = await request(app)
        .put("/api/student/change-password")
        .set("Authorization", `Bearer ${student.token}`)
        .send({
          current_password: student.password,
          new_password: "newpass123456",
        });
      expect(res.status).toBe(200);
    });

    it("returns 401 for wrong current password", async () => {
      const res = await request(app)
        .put("/api/student/change-password")
        .set("Authorization", `Bearer ${student.token}`)
        .send({
          current_password: "wrongpassword",
          new_password: "newpass123456",
        });
      expect(res.status).toBe(401);
    });

    it("returns 400 for short new password", async () => {
      const res = await request(app)
        .put("/api/student/change-password")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ current_password: student.password, new_password: "123" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when fields missing", async () => {
      const res = await request(app)
        .put("/api/student/change-password")
        .set("Authorization", `Bearer ${student.token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/student/notifications", () => {
    it("returns empty array when no notifications", async () => {
      const res = await request(app)
        .get("/api/student/notifications")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });
  });

  describe("GET /api/student/tracking/live", () => {
    it("returns 404 when no bus assigned", async () => {
      const res = await request(app)
        .get("/api/student/tracking/live")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(404);
    });

    it("returns no_signal when approved but no GPS data", async () => {
      const driver = await createDriver();
      const bus = await createTestBus();
      const route = await createTestRoute();
      const stop = await createTestStop(route.rid, 1);

      // Need route assignment so bus_id can be found
      await createTestAssignment(route.rid, bus.bid, driver.driver.id);

      // Assign student to stop
      const db = require("../src/db");
      await db.query(
        `UPDATE students SET assigned_stop_id = $1, bus_request_status = 'approved' WHERE sid = $2`,
        [stop.id, student.student.sid],
      );

      const res = await request(app)
        .get("/api/student/tracking/live")
        .set("Authorization", `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.bus).toBeNull();
      expect(res.body.trip_status).toBe("no_signal");
      expect(res.body.stop).toBeDefined();
    });

    it("returns 403 for admin", async () => {
      const res = await request(app)
        .get("/api/student/tracking/live")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(403);
    });
  });
});
