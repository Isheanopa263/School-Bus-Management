const { haversineDistance } = require("../src/services/osrm");
const { STOP_ARRIVAL_RADIUS_M } = require("../src/services/geofence");
const db = require("../src/db");
const {
  cleanDatabase,
  createTestBus,
  createTestRoute,
  createTestStop,
  createTestAssignment,
  createTestTrip,
  closePool,
} = require("./helpers/db");
const { createAdmin, createDriver } = require("./helpers/auth");

describe("Geofence & OSRM Service", () => {
  afterAll(async () => await closePool());

  describe("haversineDistance", () => {
    it("returns 0 for same point", () => {
      expect(haversineDistance(17.0, 82.0, 17.0, 82.0)).toBe(0);
    });

    it("returns correct approximate distance", () => {
      const d = haversineDistance(17.0, 82.0, 17.001, 82.0);
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThan(200);
    });

    it("is symmetric", () => {
      const d1 = haversineDistance(17.0, 82.0, 17.1, 82.1);
      const d2 = haversineDistance(17.1, 82.1, 17.0, 82.0);
      expect(Math.abs(d1 - d2)).toBeLessThan(1);
    });

    it("handles large distances", () => {
      const d = haversineDistance(0, 0, 90, 0);
      expect(d).toBeGreaterThan(9000000);
    });
  });

  describe("STOP_ARRIVAL_RADIUS_M", () => {
    it("is defined", () => {
      expect(STOP_ARRIVAL_RADIUS_M).toBeDefined();
    });

    it("is a positive number", () => {
      expect(STOP_ARRIVAL_RADIUS_M).toBeGreaterThan(0);
    });

    it("is 100 meters", () => {
      expect(STOP_ARRIVAL_RADIUS_M).toBe(100);
    });
  });

  describe("Arrival detection logic", () => {
    it("detects arrival within 100m", () => {
      const busLat = 17.0,
        busLng = 82.0;
      const stopLat = 17.0004,
        stopLng = 82.0;
      const dist = haversineDistance(busLat, busLng, stopLat, stopLng);
      expect(dist).toBeLessThan(STOP_ARRIVAL_RADIUS_M);
    });

    it("does not trigger when bus is 500m away", () => {
      const busLat = 17.0,
        busLng = 82.0;
      const stopLat = 17.005,
        stopLng = 82.0;
      const dist = haversineDistance(busLat, busLng, stopLat, stopLng);
      expect(dist).toBeGreaterThan(STOP_ARRIVAL_RADIUS_M);
    });

    it("does not trigger when bus is exactly at radius boundary", () => {
      const busLat = 17.0,
        busLng = 82.0;
      const stopLat = 17.0009,
        stopLng = 82.0;
      const dist = haversineDistance(busLat, busLng, stopLat, stopLng);
      expect(dist).toBeGreaterThan(STOP_ARRIVAL_RADIUS_M);
    });
  });

  describe("trip_stop_visits table", () => {
    beforeEach(async () => await cleanDatabase());

    it("records a stop visit", async () => {
      const admin = await createAdmin();
      const driver = await createDriver();
      const bus = await createTestBus();
      const route = await createTestRoute();
      const stop = await createTestStop(route.rid, 1);
      const assign = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const trip = await createTestTrip(assign.id);

      const { rows } = await db.query(
        `INSERT INTO trip_stop_visits (trip_id, stop_id) VALUES ($1, $2) RETURNING *`,
        [trip.id, stop.id],
      );
      expect(rows[0].trip_id).toBe(trip.id);
      expect(rows[0].stop_id).toBe(stop.id);
    });

    it("prevents duplicate visits for same trip+stop", async () => {
      const admin = await createAdmin();
      const driver = await createDriver();
      const bus = await createTestBus();
      const route = await createTestRoute();
      const stop = await createTestStop(route.rid, 1);
      const assign = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const trip = await createTestTrip(assign.id);

      await db.query(
        `INSERT INTO trip_stop_visits (trip_id, stop_id) VALUES ($1, $2)`,
        [trip.id, stop.id],
      );

      await expect(
        db.query(
          `INSERT INTO trip_stop_visits (trip_id, stop_id) VALUES ($1, $2)`,
          [trip.id, stop.id],
        ),
      ).rejects.toThrow();
    });

    it("ON CONFLICT DO NOTHING prevents duplicate error", async () => {
      const admin = await createAdmin();
      const driver = await createDriver();
      const bus = await createTestBus();
      const route = await createTestRoute();
      const stop = await createTestStop(route.rid, 1);
      const assign = await createTestAssignment(
        route.rid,
        bus.bid,
        driver.driver.id,
      );
      const trip = await createTestTrip(assign.id);

      await db.query(
        `INSERT INTO trip_stop_visits (trip_id, stop_id) VALUES ($1, $2)`,
        [trip.id, stop.id],
      );

      const { rows } = await db.query(
        `INSERT INTO trip_stop_visits (trip_id, stop_id) VALUES ($1, $2)
         ON CONFLICT (trip_id, stop_id) DO NOTHING RETURNING id`,
        [trip.id, stop.id],
      );
      expect(rows.length).toBe(0);
    });
  });
});
