// server.js - Nocturnal Backend (v3) - With Delete for Everyone
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const getDb = require('./database');
const dbPromise = getDb();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
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

// GET /messages/:sender/:receiver - Fetch chat history
app.get('/messages/:senderId/:receiverId', async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    const db = await dbPromise;

    const messages = await db.all(`
      SELECT 
        id, sender_id, receiver_id, content, type, 
        status, edited, edited_at, deleted, deleted_at, timestamp 
      FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY timestamp ASC
    `, [senderId, receiverId, receiverId, senderId]);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join_user', async (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined room user_${userId}`);
  });

  // Send new message
  socket.on('private_message', async (data) => {
    const { sender_id, receiver_id, content, timestamp, type = 'text' } = data;

    const db = await dbPromise;
    try {
      const result = await db.run(
        `INSERT INTO messages (sender_id, receiver_id, content, type, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [sender_id, receiver_id, content, type, timestamp || new Date().toISOString()]
      );

      const fullMessage = {
        id: result.lastID,
        sender_id,
        receiver_id,
        content,
        type,
        timestamp: timestamp || new Date().toISOString(),
        status: 'sent',
        edited: false,
        deleted: false
      };

      io.to(`user_${receiver_id}`).emit('new_message', fullMessage);
      socket.emit('message_sent', fullMessage);
    } catch (err) {
      console.error(err);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // ✏️ Edit Message
  socket.on('edit_message', async (data) => {
    const { message_id, sender_id, new_content } = data;

    const db = await dbPromise;
    try {
      const message = await db.get(`SELECT * FROM messages WHERE id = ? AND sender_id = ?`, [message_id, sender_id]);
      if (!message) {
        return socket.emit('edit_error', { error: 'Message not found or unauthorized' });
      }

      await db.run(
        `UPDATE messages SET content = ?, edited = 1, edited_at = ? WHERE id = ?`,
        [new_content, new Date().toISOString(), message_id]
      );

      const updatedMessage = {
        ...message,
        content: new_content,
        edited: true,
        edited_at: new Date().toISOString()
      };

      io.to(`user_${message.receiver_id}`).emit('message_edited', updatedMessage);
      socket.emit('message_edited', updatedMessage);
    } catch (err) {
      console.error(err);
      socket.emit('edit_error', { error: 'Failed to edit message' });
    }
  });

  // 🗑️ Delete for Everyone
  socket.on('delete_for_everyone', async (data) => {
    const { message_id, sender_id } = data;

    const db = await dbPromise;
    try {
      // Verify ownership
      const message = await db.get(`SELECT * FROM messages WHERE id = ? AND sender_id = ?`, [message_id, sender_id]);
      if (!message) {
        return socket.emit('delete_error', { error: 'Message not found or unauthorized' });
      }

      // Mark as deleted
      await db.run(
        `UPDATE messages SET deleted = 1, deleted_at = ?, content = '', type = 'deleted' WHERE id = ?`,
        [new Date().toISOString(), message_id]
      );

      const deletedUpdate = {
        id: message_id,
        sender_id,
        receiver_id: message.receiver_id,
        content: null,
        type: 'deleted',
        timestamp: message.timestamp,
        deleted: true,
        deleted_at: new Date().toISOString()
      };

      // Notify both sides
      io.to(`user_${message.receiver_id}`).emit('message_deleted', deletedUpdate);
      socket.emit('message_deleted', deletedUpdate);
    } catch (err) {
      console.error(err);
      socket.emit('delete_error', { error: 'Failed to delete message' });
    }
  });

  // ❌ Disconnect
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