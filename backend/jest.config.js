module.exports = {
  testEnvironment: "node",
  testTimeout: 15000,
  verbose: true,
  setupFiles: ["./tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/routes/**/*.js",
    "src/services/**/*.js",
    "!src/services/redis.js",
    "!src/services/socket.js",
    "!src/services/fcm.js",
  ],
};
