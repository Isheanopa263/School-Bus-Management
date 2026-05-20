const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, closePool } = require("./helpers/db");
const { createAdmin, createStudent, createDriver } = require("./helpers/auth");

describe("Complaints API", () => {
  let admin, student, driver;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
    student = await createStudent();
    driver = await createDriver();
  });

  afterAll(async () => await closePool());

  describe("POST /api/student/complaints", () => {
    it("creates a complaint", async () => {
      const res = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({
          category: "bus_service",
          description: "Bus was late by 20min",
          priority: "medium",
        });
      expect(res.status).toBe(201);
      expect(res.body.complaint.status).toBe("open");
      expect(res.body.complaint.category).toBe("bus_service");
    });

    it("uses default priority medium", async () => {
      const res = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ description: "General complaint" });
      expect(res.status).toBe(201);
      expect(res.body.complaint.priority).toBe("medium");
    });

    it("accepts high priority", async () => {
      const res = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ description: "Urgent issue", priority: "high" });
      expect(res.status).toBe(201);
      expect(res.body.complaint.priority).toBe("high");
    });

    it("returns 400 without description", async () => {
      const res = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ category: "other" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/complaints", () => {
    it("admin lists all complaints", async () => {
      await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ description: "Test complaint" });
      const res = await request(app)
        .get("/api/complaints")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.complaints.length).toBeGreaterThan(0);
    });

    it("returns 403 for student", async () => {
      const res = await request(app)
        .get("/api/complaints")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(403);
    });

    it("returns 403 for driver", async () => {
      const res = await request(app)
        .get("/api/complaints")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/complaints/:id/resolve", () => {
    it("admin resolves a complaint", async () => {
      const createRes = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ description: "Test complaint" });
      const complaintId = createRes.body.complaint.id;

      const res = await request(app)
        .put(`/api/complaints/${complaintId}/resolve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "resolved", resolution_notes: "Fixed the issue" });
      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe("resolved");
      expect(res.body.complaint.resolved_at).toBeDefined();
    });

    it("admin sets complaint to in_progress", async () => {
      const createRes = await request(app)
        .post("/api/student/complaints")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ description: "Test complaint" });
      const complaintId = createRes.body.complaint.id;

      const res = await request(app)
        .put(`/api/complaints/${complaintId}/resolve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "in_progress", priority: "high" });
      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe("in_progress");
    });

    it("returns 404 for non-existent complaint", async () => {
      const res = await request(app)
        .put("/api/complaints/00000000-0000-0000-0000-000000000000/resolve")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "resolved" });
      expect(res.status).toBe(404);
    });
  });
});
