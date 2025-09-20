// server.js - Nocturnal Backend
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all during dev
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: "🌙 Nocturnal Server Running" });
});

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined room user_${userId}`);
  });

  socket.on('private_message', (data) => {
    const { sender_id, receiver_id, content, timestamp } = data;
    io.to(`user_${receiver_id}`).emit('new_message', {
      sender_id,
      content,
      timestamp,
      delivered: true
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Nocturnal Server running on port ${PORT}`);
});

module.exports = { app, io };