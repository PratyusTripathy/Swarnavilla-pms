const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3'); // Changed library

let mainWindow;
let db;

// --- 1. SETUP & FOLDER SEPARATION ---
if (!app.isPackaged) {
    const devUserDataPath = path.join(app.getPath('appData'), 'swarna-pms-dev');
    app.setPath('userData', devUserDataPath);
    console.log("🚧 DEV MODE. Data Path:", devUserDataPath);
}

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'swarna_pms.db');
const uploadDir = path.join(userDataPath, 'Guest_Docs');

if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

function initDB() {
  try {
    // improved: better-sqlite3 opens synchronously
    db = new Database(dbPath); // Removed verbose mode, not needed
    db.pragma('journal_mode = WAL'); // Performance boost
    console.log('✅ Connected to SQLite at:', dbPath);
    createTables();
  } catch (err) {
    console.error('DB Error:', err);
  }
}

function createTables() {
  db.exec(`
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
  `);
  seedRates();
}

function seedRates() {
  const row = db.prepare("SELECT count(*) as count FROM rates").get();
  if (row.count === 0) {
    console.log("Seeding default rates...");
    const insert = db.prepare("INSERT INTO rates (room_no, room_type, rate) VALUES (?, ?, ?)");
    const defaults = [
      ["101", "Super Deluxe Room", 3000],
      ["102", "Super Deluxe Room", 3000],
      ["103", "Deluxe Non AC Room", 2000],
      ["104", "Deluxe Non AC Room", 2000],
      ["201", "Swarna Family Suite", 5000],
      ["202", "Swarna Family Suite", 5000]
    ];
    // Use a transaction for safety
    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item);
    });
    insertMany(defaults);
  }
}

// --- 2. WINDOW CREATION ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366, height: 768, title: "Swarna Villa PMS",
    icon: path.join(__dirname, 'public', 'Icon.PNG'),
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js')
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => { initDB(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- 3. HELPER: SAVE FILE ---
function saveFileLocally(data) {
  if (!data.fileBase64 || !data.fileExt) return null;
  try {
    const cleanName = data.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const fileName = `${data.checkIn}_${data.room}_${cleanName}_${data.idType}.${data.fileExt}`;
    const fullPath = path.join(uploadDir, fileName);
    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "").replace(/^data:application\/pdf;base64,/, "");
    fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    return fullPath;
  } catch (e) { return null; }
}

// --- 4. API HANDLERS (UPDATED FOR better-sqlite3) ---

ipcMain.handle('get-rates', () => {
  return db.prepare("SELECT * FROM rates ORDER BY room_no ASC").all();
});

ipcMain.handle('add-room', (event, { room_no, room_type, rate }) => {
  try {
    db.prepare("INSERT INTO rates (room_no, room_type, rate) VALUES (?, ?, ?)").run(room_no, room_type, rate);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-room', (event, room_no) => {
  db.prepare("DELETE FROM rates WHERE room_no = ?").run(room_no);
  return { success: true };
});

ipcMain.handle('update-room', (event, { room_no, room_type, rate }) => {
  db.prepare("UPDATE rates SET room_type = ?, rate = ? WHERE room_no = ?").run(room_type, rate, room_no);
  return { success: true };
});

ipcMain.handle('get-bookings', () => {
  return db.prepare("SELECT * FROM bookings ORDER BY id DESC").all();
});

ipcMain.handle('add-booking', async (event, data) => {
  const savedFilePath = saveFileLocally(data) || "No File";
  const stmt = db.prepare(`INSERT INTO bookings (room, name, mobile, email, idType, idNumber, fileBase64, checkIn, checkOut, days, refBy, commission, rent, advance, total, due, paymentMode, paymentRef) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  
  const info = stmt.run(
    data.room, data.name, data.mobile, data.email, data.idType, data.idNumber, 
    savedFilePath, data.checkIn, data.checkOut, data.days, data.refBy, 
    data.commission, data.rent, data.advance, data.total, data.due, 
    data.paymentMode, data.paymentRef
  );
  return { id: info.lastInsertRowid, savedFilePath };
});

ipcMain.handle('update-booking', async (event, data) => {
  let savedFilePath = data.savedFilePath;
  if (data.fileBase64 && data.fileExt) savedFilePath = saveFileLocally(data);
  
  const stmt = db.prepare(`UPDATE bookings SET room=?, name=?, mobile=?, email=?, idType=?, idNumber=?, fileBase64=?, checkIn=?, checkOut=?, days=?, refBy=?, commission=?, rent=?, advance=?, total=?, due=?, paymentMode=?, paymentRef=? WHERE id=?`);
  
  stmt.run(
    data.room, data.name, data.mobile, data.email, data.idType, data.idNumber, 
    savedFilePath, data.checkIn, data.checkOut, data.days, data.refBy, 
    data.commission, data.rent, data.advance, data.total, data.due, 
    data.paymentMode, data.paymentRef, data.id
  );
  return { success: true, savedFilePath };
});

ipcMain.handle('delete-booking', (event, id) => {
  db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
  return { success: true };
});

ipcMain.handle('get-dashboard-stats', async () => {
    try {
      const bookings = db.prepare("SELECT * FROM bookings").all();
      const pnlMap = {};
      bookings.forEach(b => {
        const date = new Date(b.checkIn);
        if (isNaN(date)) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!pnlMap[key]) pnlMap[key] = { name: key, revenue: 0, commission: 0, profit: 0, count: 0 };
        const rev = parseFloat(b.total) || 0;
        const comm = parseFloat(b.commission) || 0;
        pnlMap[key].revenue += rev;
        pnlMap[key].commission += comm;
        pnlMap[key].profit += (rev - comm);
        pnlMap[key].count += 1;
      });
      const pnlData = Object.values(pnlMap).sort((a, b) => a.name.localeCompare(b.name));

      const sourceMap = {};
      bookings.forEach(b => {
        const source = b.refBy ? b.refBy.split(' - ')[0] : 'Unknown';
        if (!sourceMap[source]) sourceMap[source] = 0;
        sourceMap[source] += 1;
      });
      const sourceData = Object.keys(sourceMap).map(k => ({ name: k, value: sourceMap[k] }));
      const totalRevenue = bookings.reduce((sum, b) => sum + (parseFloat(b.total) || 0), 0);
      const totalDue = bookings.reduce((sum, b) => sum + (parseFloat(b.due) || 0), 0);
      const totalCommission = bookings.reduce((sum, b) => sum + (parseFloat(b.commission) || 0), 0);
      return { pnlData, sourceData, summary: { totalBookings: bookings.length, totalRevenue, totalDue, netProfit: totalRevenue - totalCommission } };
    } catch (e) { console.error(e); return {}; }
});

ipcMain.handle('send-email', async (event, data) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false,
    auth: { user: 'swarnavilla.info@gmail.com', pass: 'okzc hnoo lpqa qgon' }
  });
  try {
    await transporter.sendMail({
      from: '"Swarna Villa PMS" <swarnavilla.info@gmail.com>',
      to: data.to, subject: data.subject, text: data.body,
      attachments: [{ filename: data.fileName, content: data.pdfBase64.split('base64,').pop(), encoding: 'base64' }]
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});