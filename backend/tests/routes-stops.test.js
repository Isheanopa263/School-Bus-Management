const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, createTestRoute, closePool } = require("./helpers/db");
const { createAdmin } = require("./helpers/auth");

describe("Routes & Stops API", () => {
  let admin;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
  });

  afterAll(async () => await closePool());

  describe("POST /api/routes", () => {
    it("creates route with name only", async () => {
      const res = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "Route A" });
      expect(res.status).toBe(201);
      expect(res.body.route.name).toBe("Route A");
    });

    it("creates route with all fields", async () => {
      const res = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          name: "Route B",
          total_distance_km: 30,
          estimated_duration_min: 60,
        });
      expect(res.status).toBe(201);
      expect(res.body.route.total_distance_km).toBe("30.00");
    });

    it("returns 400 without name", async () => {
      const res = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ total_distance_km: 10 });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/routes", () => {
    it("returns all active routes", async () => {
      await createTestRoute();
      await createTestRoute();
      const res = await request(app)
        .get("/api/routes")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.routes.length).toBeGreaterThanOrEqual(2);
    });

    it("includes stop_count in response", async () => {
      await createTestRoute();
      const res = await request(app)
        .get("/api/routes")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.routes[0].stop_count).toBeDefined();
    });
  });

  describe("PUT /api/routes/:id", () => {
    it("updates route name", async () => {
      const route = await createTestRoute({ name: "Old Name" });
      const res = await request(app)
        .put(`/api/routes/${route.rid}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "New Name" });
      expect(res.status).toBe(200);
      expect(res.body.route.name).toBe("New Name");
    });
  });

  describe("DELETE /api/routes/:id", () => {
    it("soft deletes route", async () => {
      const route = await createTestRoute();
      const res = await request(app)
        .delete(`/api/routes/${route.rid}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/stops", () => {
    it("adds stop to route", async () => {
      const route = await createTestRoute();
      const res = await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "Stop 1",
          latitude: 17.05,
          longitude: 82.25,
          sequence_number: 1,
        });
      expect(res.status).toBe(201);
      expect(res.body.stop.name).toBe("Stop 1");
    });

    it("adds multiple stops with different sequences", async () => {
      const route = await createTestRoute();
      await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S1",
          latitude: 17.0,
          longitude: 82.0,
          sequence_number: 1,
        });
      const res = await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S2",
          latitude: 17.1,
          longitude: 82.1,
          sequence_number: 2,
        });
      expect(res.status).toBe(201);
    });

    it("returns 409 on duplicate sequence", async () => {
      const route = await createTestRoute();
      await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S1",
          latitude: 17.0,
          longitude: 82.0,
          sequence_number: 1,
        });
      const res = await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S2",
          latitude: 17.1,
          longitude: 82.1,
          sequence_number: 1,
        });
      expect(res.status).toBe(409);
    });

    it("returns 400 without required fields", async () => {
      const route = await createTestRoute();
      const res = await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ route_id: route.rid });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/stops", () => {
    it("returns stops for a route ordered by sequence", async () => {
      const route = await createTestRoute();
      await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S2",
          latitude: 17.1,
          longitude: 82.1,
          sequence_number: 2,
        });
      await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S1",
          latitude: 17.0,
          longitude: 82.0,
          sequence_number: 1,
        });
      const res = await request(app)
        .get(`/api/stops?route_id=${route.rid}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.stops[0].sequence_number).toBe(1);
      expect(res.body.stops[1].sequence_number).toBe(2);
    });
  });

  describe("DELETE /api/stops/:id", () => {
    it("deletes a stop", async () => {
      const route = await createTestRoute();
      const stopRes = await request(app)
        .post("/api/stops")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          route_id: route.rid,
          name: "S1",
          latitude: 17.0,
          longitude: 82.0,
          sequence_number: 1,
        });
      const stopId = stopRes.body.stop.id;
      const res = await request(app)
        .delete(`/api/stops/${stopId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    });
  });
});
