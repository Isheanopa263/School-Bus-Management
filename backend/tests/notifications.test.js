const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, closePool } = require("./helpers/db");
const { createAdmin, createDriver, createStudent } = require("./helpers/auth");

describe("Notifications", () => {
  afterAll(async () => await closePool());

  describe("PUT /api/notifications/token", () => {
    it("saves FCM token for admin", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const res = await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ fcm_token: "test_fcm_token_admin_123" });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("updated");
    });

    it("saves FCM token for driver", async () => {
      await cleanDatabase();
      const driver = await createDriver();
      const res = await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ fcm_token: "test_fcm_token_driver_456" });
      expect(res.status).toBe(200);
    });

    it("saves FCM token for student", async () => {
      await cleanDatabase();
      const student = await createStudent();
      const res = await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ fcm_token: "test_fcm_token_student_789" });
      expect(res.status).toBe(200);
    });

    it("returns 400 without token", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const res = await request(app)
        .put("/api/notifications/token")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .put("/api/notifications/token")
        .send({ fcm_token: "test_token" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/student/notifications", () => {
    it("returns notifications for student", async () => {
      await cleanDatabase();
      const student = await createStudent();
      const res = await request(app)
        .get("/api/student/notifications")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });

    it("returns 403 for admin", async () => {
      await cleanDatabase();
      const admin = await createAdmin();
      const res = await request(app)
        .get("/api/student/notifications")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(403);
    });
  });
});
