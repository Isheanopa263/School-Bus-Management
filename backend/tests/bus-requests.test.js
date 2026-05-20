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
const { createAdmin, createDriver, createStudent } = require("./helpers/auth");

describe("Bus Request Workflow", () => {
  let admin, student, route, stop;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    student = await createStudent();
    const driver = await createDriver();
    const bus = await createTestBus();
    route = await createTestRoute();
    stop = await createTestStop(route.rid, 1);
    await createTestAssignment(route.rid, bus.bid, driver.driver.id);
  });

  afterAll(async () => await closePool());

  describe("POST /api/bus-requests/request", () => {
    it("submits a pending request", async () => {
      const res = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({
          home_location: "POINT(82.2475 17.0050)",
          notes: "Near campus",
        });
      expect(res.status).toBe(201);
      expect(res.body.request.status).toBe("pending");
    });

    it("returns 409 on duplicate pending", async () => {
      await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });
      const res = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });
      expect(res.status).toBe(409);
    });

    it("returns 403 for admin role", async () => {
      const res = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/bus-requests", () => {
    it("admin can list all requests", async () => {
      await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });
      const res = await request(app)
        .get("/api/bus-requests")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.requests.length).toBeGreaterThan(0);
    });

    it("returns 403 for student", async () => {
      const res = await request(app)
        .get("/api/bus-requests")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/bus-requests/:id/approve", () => {
    it("approves request with stop and route", async () => {
      const reqRes = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });

      const res = await request(app)
        .put(`/api/bus-requests/${reqRes.body.request.id}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ stop_id: stop.id, route_id: route.rid });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("approved");
    });

    it("returns 400 without stop_id or route_id", async () => {
      const reqRes = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });

      const res = await request(app)
        .put(`/api/bus-requests/${reqRes.body.request.id}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 403 for student role", async () => {
      const reqRes = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });

      const res = await request(app)
        .put(`/api/bus-requests/${reqRes.body.request.id}/approve`)
        .set("Authorization", `Bearer ${student.token}`)
        .send({ stop_id: stop.id, route_id: route.rid });
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/bus-requests/:id/reject", () => {
    it("rejects a pending request", async () => {
      const reqRes = await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });

      const res = await request(app)
        .put(`/api/bus-requests/${reqRes.body.request.id}/reject`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ admin_notes: "No seats available" });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/student/requests", () => {
    it("student views own requests", async () => {
      await request(app)
        .post("/api/bus-requests/request")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ home_location: "POINT(82.2475 17.0050)" });

      const res = await request(app)
        .get("/api/student/requests")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
      expect(res.body.requests.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/student/leave-bus", () => {
    it("student can leave bus service", async () => {
      const db = require("../src/db");
      await db.query(
        `UPDATE students SET assigned_stop_id = $1, bus_request_status = 'approved' WHERE sid = $2`,
        [stop.id, student.student.sid],
      );

      const res = await request(app)
        .post("/api/student/leave-bus")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
    });
  });
});
