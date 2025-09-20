// backend/database.js - SQLite setup for Nocturnal (v3) - With Scheduled Messages
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

(async () => {
  db = await open({
    filename: path.join(__dirname, 'nocturnal.db'),
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      type TEXT DEFAULT 'text',
      status TEXT DEFAULT 'sent',
      edited BOOLEAN DEFAULT false,
      edited_at DATETIME,
      deleted BOOLEAN DEFAULT false,
      deleted_at DATETIME,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      type TEXT DEFAULT 'text',
      scheduled_time DATETIME,
      status TEXT DEFAULT 'pending', -- pending, sent, cancelled
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(sender_id, receiver_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted);
    CREATE INDEX IF NOT EXISTS idx_scheduled_pending ON scheduled_messages(status, scheduled_time);
  `);

  console.log('✅ Database ready: messages + scheduled_messages');
})();

module.exports = () => db;