const path = require("path");
const { Pool } = require("pg");

// Load environment variables (.env.test for tests, .env for dev/prod)
const envFile =
  process.env.NODE_ENV === "test" ? "../../.env.test" : "../../.env";
require("dotenv").config({ path: path.resolve(__dirname, envFile) });

let pool;

if (process.env.DATABASE_URL) {
  // Determine if SSL is required (e.g., Supabase / Cloud DBs or DB_SSL=true)
  const isCloudDb =
    process.env.DATABASE_URL.includes("supabase.co") ||
    process.env.DATABASE_URL.includes("sslmode=require") ||
    process.env.DB_SSL === "true";

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
} else {
  // Fallback for individual env vars
  const requiredEnv = [
    "DB_USER",
    "DB_HOST",
    "DB_NAME",
    "DB_PASSWORD",
    "DB_PORT",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

pool.on("connect", () => {
  if (process.env.NODE_ENV !== "test") {
    console.log("PostgreSQL connected");
  }
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err.message);
  // Log error without crashing the server process
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
