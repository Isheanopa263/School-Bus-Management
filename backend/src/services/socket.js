const { Server } = require("socket.io");
const { createClient } = require("redis");

let io;
const subscriber = createClient({ url: process.env.REDIS_URL });

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // restrict this in prod
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Client subscribes to a specific bus
    socket.on("subscribe-bus", async (bus_id) => {
      socket.join(`bus:${bus_id}`);
      console.log(`Socket ${socket.id} subscribed to bus:${bus_id}`);
    });

    // Client unsubscribes
    socket.on("unsubscribe-bus", (bus_id) => {
      socket.leave(`bus:${bus_id}`);
      console.log(`Socket ${socket.id} unsubscribed from bus:${bus_id}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Redis subscriber for all location updates
  subscriber.connect();
  subscriber.pSubscribe("location:*", (message, channel) => {
    const bus_id = channel.split(":")[1];
    const data = JSON.parse(message);
    io.to(`bus:${bus_id}`).emit("location-update", data);
  });

  console.log("Socket.IO initialized");
  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

module.exports = { initSocket, getIO };
