const request = require("supertest");
const { app } = require("../src/app");
const {
  cleanDatabase,
  createTestBus,
  createTestRoute,
  createTestAssignment,
  closePool,
} = require("./helpers/db");
const { createAdmin, createDriver } = require("./helpers/auth");

describe("Schedule Builder - Route Assignments", () => {
  let admin, driver, bus, route;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    driver = await createDriver();
    bus = await createTestBus();
    route = await createTestRoute();
  });

  afterAll(async () => await closePool());

  const today = () => new Date().toISOString().split("T")[0];

  describe("POST /api/route-assignments", () => {
    it("creates an assignment", async () => {
      const res = await request(app)
        .post("/api/route-assignments")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          bus_id: bus.bid,
          driver_id: driver.driver.id,
          effective_date: today(),
          shift: "morning",
        });
      expect(res.status).toBe(201);
      expect(res.body.assignment.shift).toBe("morning");
    });

    it("creates afternoon shift assignment", async () => {
      const res = await request(app)
        .post("/api/route-assignments")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          bus_id: bus.bid,
          driver_id: driver.driver.id,
          effective_date: today(),
          shift: "afternoon",
        });
      expect(res.status).toBe(201);
      expect(res.body.assignment.shift).toBe("afternoon");
    });

    it("returns 409 on duplicate bus+date+shift", async () => {
      const driver2 = await createDriver();
      await request(app)
        .post("/api/route-assignments")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          bus_id: bus.bid,
          driver_id: driver.driver.id,
          effective_date: today(),
          shift: "morning",
        });
      const res = await request(app)
        .post("/api/route-assignments")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          bus_id: bus.bid,
          driver_id: driver2.driver.id,
          effective_date: today(),
          shift: "morning",
        });
      expect(res.status).toBe(409);
    });

    it("returns 400 on missing fields", async () => {
      const res = await request(app)
        .post("/api/route-assignments")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ route_id: route.rid });
      expect(res.status).toBe(400);
    });

    it("returns 403 for driver role", async () => {
      const res = await request(app)
        .post("/api/route-assignments")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          route_id: route.rid,
          bus_id: bus.bid,
          driver_id: driver.driver.id,
          effective_date: today(),
          shift: "morning",
        });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/route-assignments", () => {
    it("lists all assignments for admin", async () => {
      await createTestAssignment(route.rid, bus.bid, driver.driver.id);
      const res = await request(app)
        .get("/api/route-assignments")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.assignments.length).toBeGreaterThan(0);
    });

    it("driver sees only own assignments", async () => {
      await createTestAssignment(route.rid, bus.bid, driver.driver.id);
      const res = await request(app)
        .get("/api/route-assignments")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      res.body.assignments.forEach((a) => {
        expect(a.driver_table_id).toBe(driver.driver.id);
      });
    });
  });

  describe("DELETE /api/route-assignments/:id", () => {
    it("admin can delete assignment", async () => {
      const assignment = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const res = await request(app)
        .delete(`/api/route-assignments/${assignment.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    });

    it("driver cannot delete assignment", async () => {
      const assignment = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const res = await request(app)
        .delete(`/api/route-assignments/${assignment.id}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent assignment", async () => {
      const res = await request(app)
        .delete("/api/route-assignments/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(404);
    });
  });
  describe("PUT /api/route-assignments/:id/toggle-pause", () => {
    it("pauses an active assignment", async () => {
      const a = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const res = await request(app)
        .put(`/api/route-assignments/${a.id}/toggle-pause`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.assignment.is_paused).toBe(true);
    });

    it("resumes a paused assignment", async () => {
      const a = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );

      // Pause first
      await request(app)
        .put(`/api/route-assignments/${a.id}/toggle-pause`)
        .set("Authorization", `Bearer ${admin.token}`);

      // Resume
      const res = await request(app)
        .put(`/api/route-assignments/${a.id}/toggle-pause`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.assignment.is_paused).toBe(false);
    });

    it("returns 404 for non-existent assignment", async () => {
      const res = await request(app)
        .put(
          "/api/route-assignments/00000000-0000-0000-0000-000000000000/toggle-pause",
        )
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(404);
    });

    it("returns 403 for driver role", async () => {
      const a = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const res = await request(app)
        .put(`/api/route-assignments/${a.id}/toggle-pause`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(403);
    });

    it("paused assignment hidden from driver route today", async () => {
      const a = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );

      // Pause
      await request(app)
        .put(`/api/route-assignments/${a.id}/toggle-pause`)
        .set("Authorization", `Bearer ${admin.token}`);

      // Driver should not see this route
      const res = await request(app)
        .get("/api/driver/route/today")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/route-assignments/:id (edit)", () => {
    it("updates assignment shift", async () => {
      const a = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const res = await request(app)
        .put(`/api/route-assignments/${a.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          bus_id: bus.bid,
          driver_id: driver.driver.id,
          effective_date: new Date().toISOString().split("T")[0],
          shift: "afternoon",
        });
      expect(res.status).toBe(200);
      expect(res.body.assignment.shift).toBe("afternoon");
    });

    it("returns 400 without required fields", async () => {
      const a = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const res = await request(app)
        .put(`/api/route-assignments/${a.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ route_id: route.rid });
      expect(res.status).toBe(400);
    });
  });
});
