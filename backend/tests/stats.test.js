const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, createTestBus, closePool } = require("./helpers/db");
const { createAdmin, createStudent, createDriver } = require("./helpers/auth");

describe("Stats API", () => {
  let admin;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
  });

  afterAll(async () => await closePool());

  describe("GET /api/stats", () => {
    it("returns all stat fields", async () => {
      const res = await request(app)
        .get("/api/stats")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total_buses).toBeDefined();
      expect(res.body.stats.active_buses).toBeDefined();
      expect(res.body.stats.total_drivers).toBeDefined();
      expect(res.body.stats.active_drivers).toBeDefined();
      expect(res.body.stats.pending_requests).toBeDefined();
      expect(res.body.stats.open_complaints).toBeDefined();
    });

    it("returns 0 counts on empty DB", async () => {
      const res = await request(app)
        .get("/api/stats")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(Number(res.body.stats.total_buses)).toBe(0);
      expect(Number(res.body.stats.total_drivers)).toBe(0);
    });

    it("reflects newly created buses", async () => {
      await createTestBus();
      await createTestBus();
      const res = await request(app)
        .get("/api/stats")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(Number(res.body.stats.total_buses)).toBe(2);
      expect(Number(res.body.stats.active_buses)).toBe(2);
    });

    it("reflects newly created drivers", async () => {
      await createDriver();
      const res = await request(app)
        .get("/api/stats")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(Number(res.body.stats.total_drivers)).toBe(1);
    });

    it("returns 401 without token", async () => {
      const res = await request(app).get("/api/stats");
      expect(res.status).toBe(401);
    });

    it("returns 403 for student", async () => {
      const student = await createStudent();
      const res = await request(app)
        .get("/api/stats")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(403);
    });

    it("returns 403 for driver", async () => {
      const driver = await createDriver();
      const res = await request(app)
        .get("/api/stats")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(403);
    });
  });
});
