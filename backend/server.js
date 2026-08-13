const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const groupRoutes = require("./routes/groupRoutes");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const onlineUsers = new Map();

app.set("io", io);
app.set("onlineUsers", onlineUsers);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);
app.use(express.json());
app.use("/api/groups", groupRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "Server is running!" });
});

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const messageRoutes = require("./routes/messageRoutes");
app.use("/api/messages", messageRoutes);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} is now online`);
    io.emit("onlineUsersUpdate", Array.from(onlineUsers.keys()));
  });

  socket.on("joinGroupRoom", (groupId) => {
    socket.join(`group_${groupId}`);
    console.log(`Socket ${socket.id} joined group_${groupId}`);
  });

  socket.on("leaveGroupRoom", (groupId) => {
    socket.leave(`group_${groupId}`);
    console.log(`Socket ${socket.id} left group_${groupId}`);
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { senderId });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStopTyping", { senderId });
    }
  });

  socket.on("groupTyping", ({ senderId, senderUsername, groupId }) => {
    socket
      .to(`group_${groupId}`)
      .emit("userGroupTyping", { senderId, senderUsername });
  });

  socket.on("groupStopTyping", ({ senderId, groupId }) => {
    socket.to(`group_${groupId}`).emit("userGroupStopTyping", { senderId });
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        io.emit("onlineUsersUpdate", Array.from(onlineUsers.keys()));
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is starting on ${PORT} port`);
});
