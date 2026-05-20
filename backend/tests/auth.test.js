const request = require("supertest");
const { app } = require("../src/app");
const { cleanDatabase, closePool } = require("./helpers/db");
const { createAdmin, createDriver, createStudent } = require("./helpers/auth");

describe("Auth API", () => {
  beforeEach(async () => await cleanDatabase());
  afterAll(async () => await closePool());

  // ── Login ──────────────────────────────────────────────────────────────
  describe("POST /api/auth/login", () => {
    it("returns token on valid admin credentials", async () => {
      const admin = await createAdmin({ email: "a@test.com" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "a@test.com", password: admin.password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe("admin");
    });

    it("returns token on valid student credentials", async () => {
      const student = await createStudent({ email: "s@test.com" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "s@test.com", password: student.password });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("student");
    });

    it("returns token on valid driver credentials", async () => {
      const driver = await createDriver({ email: "d@test.com" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "d@test.com", password: driver.password });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("driver");
    });

    it("returns 401 on wrong password", async () => {
      await createAdmin({ email: "b@test.com" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "b@test.com", password: "wrongpass" });
      expect(res.status).toBe(401);
    });

    it("returns 401 on non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@test.com", password: "pass123" });
      expect(res.status).toBe(401);
    });

    it("returns 400 when email is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "pass123" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@test.com" });
      expect(res.status).toBe(400);
    });
  });

  // ── Student Registration ───────────────────────────────────────────────
  describe("POST /api/auth/register-student", () => {
    it("registers a new student and returns token", async () => {
      const res = await request(app).post("/api/auth/register-student").send({
        full_name: "New Student",
        phone: "9100000001",
        password: "student123",
        roll: "22A001",
        emergency_contact_phone: "9000000001",
      });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe("student");
    });

    it("creates student record in students table", async () => {
      const res = await request(app)
        .post("/api/auth/register-student")
        .send({ full_name: "S2", phone: "9100000002", password: "pass123456" });
      expect(res.status).toBe(201);
      expect(res.body.user.userid).toBeDefined();
    });

    it("returns 409 on duplicate phone", async () => {
      await request(app)
        .post("/api/auth/register-student")
        .send({ full_name: "S3", phone: "9100000003", password: "pass123456" });
      const res = await request(app)
        .post("/api/auth/register-student")
        .send({ full_name: "S4", phone: "9100000003", password: "pass123456" });
      expect(res.status).toBe(409);
    });

    it("returns 400 on short password", async () => {
      const res = await request(app)
        .post("/api/auth/register-student")
        .send({ full_name: "S5", phone: "9100000005", password: "123" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when phone is missing", async () => {
      const res = await request(app)
        .post("/api/auth/register-student")
        .send({ full_name: "S6", password: "pass123456" });
      expect(res.status).toBe(400);
    });
  });

  // ── JWT Middleware ─────────────────────────────────────────────────────
  describe("JWT Middleware", () => {
    it("returns 401 with no token", async () => {
      const res = await request(app).get("/api/buses");
      expect(res.status).toBe(401);
    });

    it("returns 401 with malformed token", async () => {
      const res = await request(app)
        .get("/api/buses")
        .set("Authorization", "Bearer not.a.token");
      expect(res.status).toBe(401);
    });

    it("returns 401 with expired token", async () => {
      const jwt = require("jsonwebtoken");
      const expired = jwt.sign(
        { userid: "test", role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "0s" },
      );
      const res = await request(app)
        .get("/api/buses")
        .set("Authorization", `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it("returns 200 with valid token", async () => {
      const admin = await createAdmin();
      const res = await request(app)
        .get("/api/buses")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Role Based Access ──────────────────────────────────────────────────
  describe("Role Based Access", () => {
    it("student cannot access admin buses route", async () => {
      const student = await createStudent();
      const res = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ registration_number: "X", capacity: 10 });
      expect(res.status).toBe(403);
    });

    it("driver cannot access admin buses route", async () => {
      const driver = await createDriver();
      const res = await request(app)
        .post("/api/buses")
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ registration_number: "X", capacity: 10 });
      expect(res.status).toBe(403);
    });

    it("student cannot access admin complaints list", async () => {
      const student = await createStudent();
      const res = await request(app)
        .get("/api/complaints")
        .set("Authorization", `Bearer ${student.token}`);
      expect(res.status).toBe(403);
    });

    it("driver cannot access student tracking", async () => {
      const driver = await createDriver();
      const res = await request(app)
        .get("/api/student/tracking/live")
        .set("Authorization", `Bearer ${driver.token}`);
      expect(res.status).toBe(403);
    });
  });
});
