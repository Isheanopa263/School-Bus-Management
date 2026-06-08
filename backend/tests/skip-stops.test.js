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
const { createAdmin, createDriver } = require("./helpers/auth");

describe("Skip Stops", () => {
  let admin, driver, bus, route, stop1, stop2, assignment, tripId;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    driver = await createDriver();
    bus = await createTestBus();
    route = await createTestRoute();
    stop1 = await createTestStop(route.rid, 1, { name: "Stop A" });
    stop2 = await createTestStop(route.rid, 2, { name: "Stop B" });

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

    const tripRes = await request(app)
      .post("/api/driver/trips/start")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ trip_type: "pickup" });
    tripId = tripRes.body.trip.id;
  });

  afterAll(async () => await closePool());

  describe("POST /api/driver/stops/skip", () => {
    it("skips a stop with reason", async () => {
      const res = await request(app)
        .post("/api/driver/stops/skip")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          stop_id: stop1.id,
          reason: "Road blocked",
        });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("skipped");
    });

    it("skips a stop without reason", async () => {
      const res = await request(app)
        .post("/api/driver/stops/skip")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          stop_id: stop1.id,
        });
      expect(res.status).toBe(200);
    });

    it("returns 400 without required fields", async () => {
      const res = await request(app)
        .post("/api/driver/stops/skip")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId });
      expect(res.status).toBe(400);
    });

    it("returns 403 for admin role", async () => {
      const res = await request(app)
        .post("/api/driver/stops/skip")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ trip_id: tripId, stop_id: stop1.id });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/driver/stops/status/:tripId", () => {
    it("returns empty statuses for new trip", async () => {
      const res = await request(app)
        .get(`/api/driver/stops/status/${tripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.statuses).toBeDefined();
    });

    it("shows skipped status after skipping", async () => {
      await request(app)
        .post("/api/driver/stops/skip")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId, stop_id: stop1.id, reason: "Test" });

      const res = await request(app)
        .get(`/api/driver/stops/status/${tripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.statuses[stop1.id]).toBeDefined();
      expect(res.body.statuses[stop1.id].skipped).toBe(true);
    });
  });
});
