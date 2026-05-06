const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { hashPassword, comparePassword } = require("../utils/hash");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_ROLES = ["admin", "driver", "parent", "attendant"];

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

module.exports = router;
