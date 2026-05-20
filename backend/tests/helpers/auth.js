const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../src/db");

async function createTestUser(role = "admin", overrides = {}) {
  const ts = Date.now();
  const defaults = {
    full_name: `Test ${role} ${ts}`,
    email: `${role}_${ts}@test.com`,
    phone: `9${ts.toString().slice(-9)}`,
    password: "testpass123",
  };
  const data = { ...defaults, ...overrides };
  const password_hash = await bcrypt.hash(data.password, 8);

  const { rows } = await db.query(
    `INSERT INTO users (role, full_name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING userid, role, full_name, email, phone`,
    [role, data.full_name, data.email, data.phone, password_hash],
  );

  const user = rows[0];
  const token = jwt.sign(
    { userid: user.userid, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  return { user, token, password: data.password };
}

async function createAdmin(overrides = {}) {
  return createTestUser("admin", overrides);
}

async function createDriver(overrides = {}) {
  const auth = await createTestUser("driver", overrides);
  const { rows } = await db.query(
    `INSERT INTO drivers (userid, license_number, license_expiry)
     VALUES ($1, $2, $3) RETURNING *`,
    [auth.user.userid, `LIC-${Date.now()}`, "2027-12-31"],
  );
  return { ...auth, driver: rows[0] };
}

async function createStudent(overrides = {}) {
  const auth = await createTestUser("student", overrides);
  const { rows } = await db.query(
    `INSERT INTO students (userid, roll, bus_request_status)
     VALUES ($1, $2, 'inactive') RETURNING *`,
    [auth.user.userid, `ROLL-${Date.now()}`],
  );
  return { ...auth, student: rows[0] };
}

module.exports = { createTestUser, createAdmin, createDriver, createStudent };
