const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { hashPassword, comparePassword } = require("../utils/hash");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_ROLES = ["admin", "driver", "student"];

/**
 * POST /api/auth/register
 * Admin only - create new user
 */
router.post(
  "/register",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { role, full_name, email, phone, password } = req.body;

    // Validation
    if (!role || !full_name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    try {
      const password_hash = await hashPassword(password);
      const { rows } = await db.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING userid, role, full_name, email, phone, created_at`,
        [role, full_name, email, phone, password_hash],
      );

      res.status(201).json({ user: rows[0] });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Email or phone already exists" });
      }
      console.error("Register error:", err);
      res.status(500).json({ error: "Failed to create user" });
    }
  },
);

/**
 * POST /api/auth/login
 * Public - returns JWT token
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const { rows } = await db.query(
      "SELECT userid, role, full_name, email, password_hash, is_active FROM users WHERE email = $1",
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userid: user.userid, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.json({
      token,
      user: {
        userid: user.userid,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/users
 * Admin only - list all users
 */
router.get("/users", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT userid, role, full_name, email, phone, is_active, created_at FROM users ORDER BY created_at DESC",
    );
    res.json({ users: rows });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * POST /api/auth/register-student
 * PUBLIC - Student self registration
 */
router.post("/register-student", async (req, res) => {
  const { full_name, email, phone, password, roll, emergency_contact_phone } =
    req.body;

  if (!full_name || !phone || !password) {
    return res
      .status(400)
      .json({ error: "full_name, phone and password required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create user account
    const password_hash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ('student', $1, $2, $3, $4)
       RETURNING userid, role, full_name, email, phone`,
      [full_name, email || null, phone, password_hash],
    );
    const user = userResult.rows[0];

    // 2. Create student profile
    await client.query(
      `INSERT INTO students (userid, roll, emergency_contact_phone)
       VALUES ($1, $2, $3)`,
      [user.userid, roll || null, emergency_contact_phone || null],
    );

    await client.query("COMMIT");

    // 3. Auto login - return token
    const token = jwt.sign(
      { userid: user.userid, role: "student" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.status(201).json({
      token,
      user: {
        userid: user.userid,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
      },
      message: "Account created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Phone or email already registered" });
    }
    console.error("Student register error:", err);
    res.status(500).json({ error: "Registration failed" });
  } finally {
    client.release();
  }
});

module.exports = router;
