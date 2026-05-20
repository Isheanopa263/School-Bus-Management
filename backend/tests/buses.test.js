const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, closePool } = require("./helpers/db");
const { createAdmin, createStudent } = require("./helpers/auth");

describe("Buses API", () => {
  let admin;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
  });

  afterAll(async () => await closePool());

  describe("POST /api/buses", () => {
    it("creates a bus with all fields", async () => {
      const res = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          registration_number: "AP01-AA-0001",
          capacity: 50,
          model: "Tata Starbus",
          gps_device_id: "GPS-001",
          status: "active",
        });
      expect(res.status).toBe(201);
      expect(res.body.bus.registration_number).toBe("AP01-AA-0001");
      expect(res.body.bus.capacity).toBe(50);
    });

    it("creates a bus with minimum fields", async () => {
      const res = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "AP01-BB-0001", capacity: 30 });
      expect(res.status).toBe(201);
    });

    it("returns 409 on duplicate registration number", async () => {
      await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "DUP-001", capacity: 30 });
      const res = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "DUP-001", capacity: 30 });
      expect(res.status).toBe(409);
    });

    it("returns 403 for student role", async () => {
      const student = await createStudent();
      const res = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ registration_number: "STU-001", capacity: 30 });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/buses", () => {
    it("returns empty array when no buses", async () => {
      const res = await request(app)
        .get("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.buses)).toBe(true);
    });

    it("returns all buses", async () => {
      await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "LIST-001", capacity: 30 });
      await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "LIST-002", capacity: 40 });
      const res = await request(app)
        .get("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.buses.length).toBe(2);
    });
  });

  describe("PUT /api/buses/:id", () => {
    it("updates bus status", async () => {
      const createRes = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "UPD-001", capacity: 30 });
      const busId = createRes.body.bus.bid;
      const res = await request(app)
        .put(`/api/buses/${busId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "maintenance" });
      expect(res.status).toBe(200);
      expect(res.body.bus.status).toBe("maintenance");
    });
  });

  describe("DELETE /api/buses/:id", () => {
    it("deletes a bus", async () => {
      const createRes = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ registration_number: "DEL-001", capacity: 30 });
      const busId = createRes.body.bus.bid;
      const res = await request(app)
        .delete(`/api/buses/${busId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 204]).toContain(res.status);
    });
  });
});
