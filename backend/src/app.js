const path = require("path");
const express = require("express");
const cors = require("cors");

// Load env from root directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = express();

// Middleware
app.use(cors());
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
app.use("/api/bus-requests", require("./routes/bus-requests"));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
