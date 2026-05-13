const { Server } = require("socket.io");
const { createClient } = require("redis");

let io;
let subscriber = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // restrict in prod
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("subscribe-bus", async (bus_id) => {
      socket.join(`bus:${bus_id}`);
      console.log(`Socket ${socket.id} subscribed to bus:${bus_id}`);
    });

    socket.on("unsubscribe-bus", (bus_id) => {
      socket.leave(`bus:${bus_id}`);
      console.log(`Socket ${socket.id} unsubscribed from bus:${bus_id}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Only connect Redis subscriber if REDIS_URL is set
  if (process.env.REDIS_URL) {
    subscriber = createClient({ url: process.env.REDIS_URL });

    subscriber.on("error", (err) => {
      console.warn("Socket Redis subscriber error:", err.message);
    });

    subscriber
      .connect()
      .then(() => {
        console.log("Socket Redis subscriber connected");

        subscriber.pSubscribe("location:*", (message, channel) => {
          const bus_id = channel.split(":")[1];
          const data = JSON.parse(message);
          io.to(`bus:${bus_id}`).emit("location-update", data);
        });
      })
      .catch((err) => {
        console.warn(
          "Socket Redis subscriber failed - live tracking via pub/sub disabled:",
          err.message,
        );
      });
  } else {
    console.warn("REDIS_URL not set - pub/sub live tracking disabled");
  }

  console.log("Socket.IO initialized");
  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

module.exports = { initSocket, getIO };
