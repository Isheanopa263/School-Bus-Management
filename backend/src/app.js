const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");

// Load env - use .env.test for test environment
const envFile = process.env.NODE_ENV === "test" ? "../.env.test" : "../.env";
require("dotenv").config({ path: path.resolve(__dirname, envFile) });

const app = express();
const server = http.createServer(app);

// Only init socket and redis in non-test mode
if (process.env.NODE_ENV !== "test") {
  const { initSocket } = require("./services/socket");
  require("./services/redis");
  initSocket(server);
}

// Middleware
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5501",
      "http://localhost:5501",
      "http://localhost:3001",
      "http://127.0.0.1:5502",
      "http://localhost:5502",
      "http://127.0.0.1:5503",
      "http://localhost:5503",
      "https://bus-system-62850.firebaseapp.com",
      "https://your-app.vercel.app",
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/buses", require("./routes/buses"));
app.use("/api/students", require("./routes/students"));
app.use("/api/routes", require("./routes/routes"));
app.use("/api/drivers", require("./routes/drivers"));
app.use("/api/stops", require("./routes/stops"));
app.use("/api/route-assignments", require("./routes/route-assignments"));
app.use("/api/bus-requests", require("./routes/bus_requests"));
app.use("/api/trips", require("./routes/trips"));
app.use("/api/live-locations", require("./routes/live_locations"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/complaints", require("./routes/complaints"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/schedules", require("./routes/schedules"));
app.use("/api/driver", require("./routes/driver"));
app.use("/api/student", require("./routes/student"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Only start server if not in test mode
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

module.exports = { app, server };
