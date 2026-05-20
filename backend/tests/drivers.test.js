const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, createTestBus, closePool } = require("./helpers/db");
const { createAdmin } = require("./helpers/auth");

describe("Drivers API", () => {
  let admin;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
  });

  afterAll(async () => await closePool());

  const driverPayload = (overrides = {}) => ({
    full_name: "Test Driver",
    phone: `9${Date.now().toString().slice(-9)}`,
    password: "driver123456",
    license_number: `LIC-${Date.now()}`,
    license_expiry: "2027-12-31",
    ...overrides,
  });

  describe("POST /api/drivers", () => {
    it("creates user + driver record", async () => {
      const res = await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send(driverPayload());
      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.driver).toBeDefined();
      expect(res.body.driver.license_number).toBeDefined();
    });

    it("assigns bus to driver on creation", async () => {
      const bus = await createTestBus();
      const res = await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send(driverPayload({ current_bus_id: bus.bid }));
      expect(res.status).toBe(201);
      expect(res.body.driver.current_bus_id).toBe(bus.bid);
    });

    it("returns 400 when required fields missing", async () => {
      const res = await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ full_name: "No Phone Driver" });
      expect(res.status).toBe(400);
    });

    it("returns 409 on duplicate license number", async () => {
      const payload = driverPayload({ license_number: "DUP-LIC" });
      await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send(payload);
      const res = await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ ...driverPayload(), license_number: "DUP-LIC" });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/drivers", () => {
    it("returns all drivers", async () => {
      await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send(driverPayload());
      const res = await request(app)
        .get("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.drivers.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/drivers/:id", () => {
    it("updates driver status", async () => {
      const createRes = await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send(driverPayload());
      const driverId = createRes.body.driver.id;
      const res = await request(app)
        .put(`/api/drivers/${driverId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          license_number: createRes.body.driver.license_number,
          license_expiry: "2027-12-31",
          employment_status: "on_leave",
          current_bus_id: null,
        });
      expect(res.status).toBe(200);
      expect(res.body.driver.employment_status).toBe("on_leave");
    });

    it("can unassign bus from driver", async () => {
      const bus = await createTestBus();
      const createRes = await request(app)
        .post("/api/drivers")
        .set("Authorization", `Bearer ${admin.token}`)
        .send(driverPayload({ current_bus_id: bus.bid }));
      const driverId = createRes.body.driver.id;
      const res = await request(app)
        .put(`/api/drivers/${driverId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          license_number: createRes.body.driver.license_number,
          license_expiry: "2027-12-31",
          current_bus_id: null,
        });
      expect(res.status).toBe(200);
      expect(res.body.driver.current_bus_id).toBeNull();
    });
  });
});
