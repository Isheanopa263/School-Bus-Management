const path = require("path");
const { Pool } = require("pg");

// Load environment variables from root.env
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// Validate required env vars exist
const requiredEnv = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PASSWORD", "DB_PORT"];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  max: 10, // max number of clients in pool
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 2000, // return error after 2s if can't connect
});

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
