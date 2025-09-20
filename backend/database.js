// backend/database.js - SQLite setup for Nocturnal (v2) - With Delete Support
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

    -- Index for faster chat lookups
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(sender_id, receiver_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted);
  `);

  console.log('✅ Database & tables ready (with delete support)');
})();

module.exports = () => db;