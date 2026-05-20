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

describe("GPS Location Update", () => {
  let driver, admin, tripId;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    driver = await createDriver();
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

    const tripRes = await request(app)
      .post("/api/driver/trips/start")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ trip_type: "pickup" });

    tripId = tripRes.body.trip.id;
  });

  afterAll(async () => await closePool());

  describe("POST /api/driver/location/update", () => {
    it("accepts valid GPS coordinates", async () => {
      const res = await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          latitude: 17.005,
          longitude: 82.247,
          speed: 35,
          heading: 90,
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("returns 400 without trip_id", async () => {
      const res = await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ latitude: 17.0, longitude: 82.0 });
      expect(res.status).toBe(400);
    });

    it("returns 400 without latitude", async () => {
      const res = await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId, longitude: 82.0 });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid coordinates", async () => {
      const res = await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId, latitude: 999, longitude: 999 });
      expect(res.status).toBe(400);
    });

    it("saves location to live_locations table", async () => {
      await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({
          trip_id: tripId,
          latitude: 17.005,
          longitude: 82.247,
          speed: 30,
          heading: 180,
        });

      const histRes = await request(app)
        .get(`/api/driver/location/history/${tripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(histRes.status).toBe(200);
      expect(histRes.body.total_points).toBeGreaterThan(0);
      expect(histRes.body.locations[0].latitude).toBeCloseTo(17.005, 2);
    });

    it("returns 403 for admin role", async () => {
      const res = await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ trip_id: tripId, latitude: 17.0, longitude: 82.0 });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/driver/location/history/:tripId", () => {
    it("returns location history for a trip", async () => {
      await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId, latitude: 17.001, longitude: 82.001 });
      await request(app)
        .post("/api/driver/location/update")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_id: tripId, latitude: 17.002, longitude: 82.002 });

      const res = await request(app)
        .get(`/api/driver/location/history/${tripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.total_points).toBe(2);
      expect(res.body.locations.length).toBe(2);
    });

    it("returns 0 points before any updates", async () => {
      // End the current trip first
      await request(app)
        .post(`/api/driver/trips/${tripId}/end`)
        .set("Authorization", `Bearer ${driver.token}`);

      // Start new trip
      const newTripRes = await request(app)
        .post("/api/driver/trips/start")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ trip_type: "drop" });

      expect(newTripRes.status).toBe(201);
      const newTripId = newTripRes.body.trip.id;

      const res = await request(app)
        .get(`/api/driver/location/history/${newTripId}`)
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      expect(res.body.total_points).toBe(0);
    });
  });
});
