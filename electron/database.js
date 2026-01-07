const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const fs = require('fs');

let db;
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'swarna_pms.db');

// Ensure Data Directory Exists
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

function initDB() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // Performance: Non-blocking writes
    createTables();
    console.log('✅ Database connected at:', dbPath);
    return db;
  } catch (err) {
    console.error('❌ DB Error:', err);
  }
}

function getDB() {
  if (!db) return initDB();
  return db;
}

function createTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT, name TEXT, mobile TEXT, email TEXT,
      idType TEXT, idNumber TEXT, fileBase64 TEXT,
      checkIn TEXT, checkOut TEXT, days INTEGER,
      refBy TEXT, commission INTEGER, rent INTEGER,
      advance INTEGER, total INTEGER, due INTEGER,
      paymentMode TEXT, paymentRef TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rates (
      room_no TEXT PRIMARY KEY,
      room_type TEXT,
      rate INTEGER
    );
    -- 🚀 PERFORMANCE INDICES (New)
    CREATE INDEX IF NOT EXISTS idx_bookings_mobile ON bookings(mobile);
    CREATE INDEX IF NOT EXISTS idx_bookings_name ON bookings(name);
    CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room);
    CREATE INDEX IF NOT EXISTS idx_bookings_checkIn ON bookings(checkIn);
  `;
  db.exec(schema);
  seedRates();
}

function seedRates() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM rates').get();
  if (row.count === 0) {
    const defaults = [
      ['101', 'Super Deluxe Room', 3000],
      ['102', 'Super Deluxe Room', 3000],
      ['103', 'Deluxe Non AC Room', 2000],
      ['104', 'Deluxe Non AC Room', 2000],
      ['201', 'Swarna Family Suite', 5000],
      ['202', 'Swarna Family Suite', 5000],
    ];
    const stmt = db.prepare('INSERT INTO rates (room_no, room_type, rate) VALUES (?, ?, ?)');
    const insertMany = db.transaction(rows => { for (const r of rows) stmt.run(r); });
    insertMany(defaults);
  }
}

module.exports = { getDB, initDB };