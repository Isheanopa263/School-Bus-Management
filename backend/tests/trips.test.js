const request = require("supertest");
const { app } = require("../src/app");
const db = require("../src/db");
const {
  cleanDatabase,
  createTestBus,
  createTestRoute,
  createTestStop,
  createTestAssignment,
  closePool,
} = require("./helpers/db");
const { createAdmin, createDriver } = require("./helpers/auth");

describe("Driver Trip Workflow", () => {
  let admin, driver, bus, route, assignment;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    driver = await createDriver();
    bus = await createTestBus();
    route = await createTestRoute();

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
  });

  afterAll(async () => await closePool());

  describe("GET /api/driver/route/today", () => {
    it("returns today route for driver", async () => {
      const res = await request(app)
        .get("/api/driver/route/today")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.assignment).toBeDefined();
      expect(res.body.stops).toBeDefined();
      expect(res.body.total_stops).toBeDefined();
    });

    it("returns 403 for admin role", async () => {
      const res = await request(app)
        .get("/api/driver/route/today")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(403);
    });

    it("includes route_path in response", async () => {
      // Create route with path
      const routeWithPath = await createTestRoute({
        name: "Path Test Route",
      });

      // Need to add route_path manually since helper doesn't set it
      await db.query(
        `UPDATE routes SET route_path = ST_GeomFromText('LINESTRING(82.13 17.08, 82.07 17.09)', 4326) WHERE rid = $1`,
        [routeWithPath.rid],
      );

      const stopP = await createTestStop(routeWithPath.rid, 1);
      const busP = await createTestBus({
        registration_number: `PATH-${Date.now()}`,
      });
      const driver2 = await createDriver();

      await request(app)
        .put(`/api/drivers/${driver2.driver.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          current_bus_id: busP.bid,
          license_number: driver2.driver.license_number,
          license_expiry: "2027-12-31",
        });

      await createTestAssignment(
        routeWithPath.rid,
        busP.bid,
        driver2.driver.id,
      );

      const res = await request(app)
        .get("/api/driver/route/today")
        .set("Authorization", `Bearer ${driver2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.assignment.route_path).toBeDefined();
      expect(res.body.assignment.route_path).toContain("LINESTRING");
    });
  });

  describe("POST /api/driver/trips/start", () => {
    it("starts a pickup trip", async () => {
      const res = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });
      expect(res.status).toBe(201);
      expect(res.body.trip.status).toBe("ongoing");
      expect(res.body.trip.trip_type).toBe("pickup");
    });

    it("starts a drop trip", async () => {
      const res = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "drop" });
      expect(res.status).toBe(201);
      expect(res.body.trip.trip_type).toBe("drop");
    });

    it("returns 400 for invalid trip_type", async () => {
      const res = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "invalid" });
      expect(res.status).toBe(400);
    });

    it("returns 409 when trip already ongoing", async () => {
      await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });
      const res = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });
      expect(res.status).toBe(409);
    });

    it("returns 403 for admin role", async () => {
      const res = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ trip_type: "pickup" });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/driver/trips/:id/end", () => {
    it("ends an ongoing trip", async () => {
      const startRes = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });
      const tripId = startRes.body.trip.id;

      const endRes = await request(app)
        .post(`/api/driver/trips/${tripId}/end`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(endRes.status).toBe(200);
      expect(endRes.body.trip.status).toBe("completed");
      expect(endRes.body.trip.end_time).toBeDefined();
      expect(endRes.body.trip.delay_minutes).toBeDefined();
    });

    it("returns 404 for non-existent trip", async () => {
      const res = await request(app)
        .post("/api/driver/trips/00000000-0000-0000-0000-000000000000/end")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(404);
    });

    it("returns 400 when ending already completed trip", async () => {
      const startRes = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "pickup" });
      const tripId = startRes.body.trip.id;

      await request(app)
        .post(`/api/driver/trips/${tripId}/end`)
        .set("Authorization", `Bearer ${driver.token}`);

      const res = await request(app)
        .post(`/api/driver/trips/${tripId}/end`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(400);
    });
  });
});
