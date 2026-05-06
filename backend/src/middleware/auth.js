const jwt = require("jsonwebtoken");
const db = require("../db");

/**
 * Verify JWT token and attach user to request
 * Sets req.user = { userid, role, full_name, email }
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      "SELECT userid, role, full_name, email, is_active FROM users WHERE userid = $1",
      [decoded.userid],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    req.user = {
      userid: user.userid,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

/**
 * Restrict access to specific roles
 * Usage: router.post('/', requireAuth, requireRole(['admin']), handler)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };
