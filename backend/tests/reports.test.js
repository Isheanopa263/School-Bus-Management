const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, closePool } = require("./helpers/db");
const { createAdmin, createStudent } = require("./helpers/auth");

describe("Reports API", () => {
  let admin;

  beforeEach(async () => {
    await cleanDatabase();
    admin = await createAdmin();
  });

  afterAll(async () => await closePool());

  const REPORTS = [
    "trips",
    "delays",
    "driver-hours",
    "bus-utilization",
    "on-time-performance",
    "route-efficiency",
    "student-load",
    "complaints-summary",
  ];

  describe("All report endpoints return 200", () => {
    REPORTS.forEach((type) => {
      it(`GET /api/reports/${type}`, async () => {
        const res = await request(app)
          .get(`/api/reports/${type}?from=2024-01-01&to=2026-12-31`)
          .set("Authorization", `Bearer ${admin.token}`);
        expect(res.status).toBe(200);
      });
    });
  });

  describe("CSV Export", () => {
    REPORTS.forEach((type) => {
      it(`exports ${type} as CSV`, async () => {
        const res = await request(app)
          .get(`/api/reports/${type}?from=2024-01-01&to=2026-12-31&format=csv`)
          .set("Authorization", `Bearer ${admin.token}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/csv");
      });
    });
  });

  describe("PDF Export", () => {
    it("exports trips as PDF", async () => {
      const res = await request(app)
        .get("/api/reports/trips?from=2024-01-01&to=2026-12-31&format=pdf")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });

    it("exports complaints-summary as PDF", async () => {
      const res = await request(app)
        .get(
          "/api/reports/complaints-summary?from=2024-01-01&to=2026-12-31&format=pdf",
        )
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });
  });

  describe("Access Control", () => {
    it("returns 200 without token (reports are public)", async () => {
      const res = await request(app).get("/api/reports/trips");
      expect(res.status).toBe(200);
    });

    it("returns 200 for student (reports are public)", async () => {
      const student = await createStudent();
      const res = await request(app)
        .get("/api/reports/trips?from=2024-01-01&to=2026-12-31")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(200);
    });
  });

  describe("Date Filtering", () => {
    it("accepts valid date range", async () => {
      const res = await request(app)
        .get("/api/reports/trips?from=2026-01-01&to=2026-12-31")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    });

    it("works without date filters", async () => {
      const res = await request(app)
        .get("/api/reports/trips")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    });
  });
});
