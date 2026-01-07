const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

let mainWindow;
let db;

/* ------------------------------------------------------------------
   0. CONFIG & PATH MANAGEMENT
------------------------------------------------------------------- */
const DEFAULT_CONFIG = {
  guestDocsPath: path.join(app.getPath('userData'), 'Guest_Docs'),
  adminPassword: "admin123" 
};

function getConfigFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const configFile = getConfigFile();
    if (!fs.existsSync(configFile)) {
      ensureDirExists(app.getPath('userData'));
      fs.writeFileSync(configFile, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    const loaded = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...loaded };
  } catch (e) {
    console.error("Config Load Error:", e);
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(getConfigFile(), JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error("Config Save Error:", e);
  }
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/* ------------------------------------------------------------------
   1. DATA PATHS & DB INIT
------------------------------------------------------------------- */
const userDataPath = app.getPath('userData');
ensureDirExists(userDataPath);
const dbPath = path.join(userDataPath, 'swarna_pms.db');

function initDB() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); 
    createTables();
  } catch (err) {
    console.error('❌ DB Error:', err);
  }
}

function createTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT, name TEXT, mobile TEXT, email TEXT,
      idType TEXT, idNumber TEXT, fileBase64 TEXT, fileExt TEXT,
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
  `;
  db.exec(schema);

  // --- 🛠️ MIGRATION FIX: Add fileExt if missing in old DBs ---
  try {
    const columns = db.prepare("PRAGMA table_info(bookings)").all();
    const hasFileExt = columns.some(c => c.name === 'fileExt');
    if (!hasFileExt) {
        db.prepare("ALTER TABLE bookings ADD COLUMN fileExt TEXT").run();
        console.log("✅ Database Migrated: Added 'fileExt' column.");
    }
  } catch (error) {
    console.log("Migration Note: ", error.message);
  }
  
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

/* ------------------------------------------------------------------
   2. WINDOW
------------------------------------------------------------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366, height: 768, title: 'Swarna Villa PMS',
    icon: path.join(__dirname, 'public', 'icon.png'), 
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  const cfg = loadConfig();
  ensureDirExists(cfg.guestDocsPath); 
  initDB();
  createWindow();
});

/* ------------------------------------------------------------------
   3. IPC HANDLERS
------------------------------------------------------------------- */

// --- CONFIG ---
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('check-password', (e, pwd) => loadConfig().adminPassword === pwd);
ipcMain.handle('change-password', (e, newPwd) => {
    const config = loadConfig();
    config.adminPassword = newPwd;
    saveConfig(config);
    return { success: true };
});
ipcMain.handle('update-guest-doc-path', (e, p) => {
    ensureDirExists(p);
    const config = loadConfig();
    config.guestDocsPath = p;
    saveConfig(config);
    return { success: true };
});

// --- ROOMS ---
ipcMain.handle('get-rates', () => {
  const rows = db.prepare('SELECT * FROM rates ORDER BY room_no ASC').all();
  const ratesObj = {};
  rows.forEach(row => { ratesObj[row.room_no] = { type: row.room_type, rate: row.rate }; });
  return ratesObj;
});

ipcMain.handle('add-room', (e, r) => {
  try {
      db.prepare('INSERT INTO rates (room_no, room_type, rate) VALUES (?, ?, ?)').run(r.room_no, r.room_type, r.rate); 
      return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-room', (e, r) => {
  db.prepare('UPDATE rates SET room_type=?, rate=? WHERE room_no=?').run(r.room_type, r.rate, r.room_no); 
  return { success: true };
});

ipcMain.handle('delete-room', (e, room_no) => {
  db.prepare('DELETE FROM rates WHERE room_no=?').run(room_no); 
  return { success: true };
});

// --- BOOKINGS ---
ipcMain.handle('get-bookings', () => db.prepare('SELECT * FROM bookings ORDER BY id DESC').all());

ipcMain.handle('add-booking', (e, data) => {
    try {
        // Save file locally if base64 provided
        let savedPath = "No File";
        if (data.fileBase64 && data.fileExt) {
            savedPath = saveFileLocally(data);
        }
        
        const stmt = db.prepare(`
            INSERT INTO bookings (
                room, name, mobile, email, idType, idNumber, fileBase64, fileExt,
                checkIn, checkOut, days, refBy, commission, rent, 
                advance, total, due, paymentMode
            ) VALUES (
                @room, @name, @mobile, @email, @idType, @idNumber, @fileBase64, @fileExt,
                @checkIn, @checkOut, @days, @refBy, @commission, @rent, 
                @advance, @total, @due, @paymentMode
            )
        `);
        
        stmt.run({ ...data, fileBase64: savedPath });
        return { success: true };
    } catch(err) {
        console.error("Add Booking Error:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('update-booking', (e, data) => {
    try {
        // Check if new file is being uploaded
        let finalPath = data.savedFilePath || data.fileBase64; 
        
        // If it looks like base64 data, save it
        if (data.fileBase64 && data.fileBase64.startsWith('data:')) {
             finalPath = saveFileLocally(data);
        }

        const stmt = db.prepare(`
            UPDATE bookings SET 
                room=@room, name=@name, mobile=@mobile, email=@email, 
                idType=@idType, idNumber=@idNumber, fileBase64=@fileBase64, 
                checkIn=@checkIn, checkOut=@checkOut, days=@days, 
                refBy=@refBy, commission=@commission, rent=@rent, 
                advance=@advance, total=@total, due=@due, paymentMode=@paymentMode 
            WHERE id=@id
        `);
        
        stmt.run({ ...data, fileBase64: finalPath });
        return { success: true };
    } catch(err) {
        console.error("Update Booking Error:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-booking', (e, id) => {
  db.prepare('DELETE FROM bookings WHERE id=?').run(id); 
  return { success: true };
});

// --- DASHBOARD STATS ---
ipcMain.handle('get-dashboard-stats', () => {
  try {
    const bookings = db.prepare("SELECT * FROM bookings").all();
    const pnlMap = {}; 
    const sourceMap = {};
    let totalRevenue = 0, totalDue = 0, totalCommission = 0;

    bookings.forEach(b => {
      // 1. Safe Number Parsing
      const total = parseFloat(b.total) || 0;
      const due = parseFloat(b.due) || 0;
      const commission = parseFloat(b.commission) || 0;
      const profit = total - commission;

      // 2. Aggregates
      totalRevenue += total;
      totalDue += due;
      totalCommission += commission;

      // 3. Source Mapping
      let source = 'Direct';
      if (b.refBy && b.refBy.includes('-')) source = b.refBy.split('-')[0].trim();
      else if (b.refBy) source = b.refBy;
      sourceMap[source] = (sourceMap[source] || 0) + 1;

      // 4. Monthly Mapping
      if (b.checkIn) {
          const date = new Date(b.checkIn);
          if (!isNaN(date)) {
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              if (!pnlMap[key]) pnlMap[key] = { name: key, revenue: 0, profit: 0 };
              pnlMap[key].revenue += total;
              pnlMap[key].profit += profit;
          }
      }
    });

    return {
      pnlData: Object.values(pnlMap).sort((a, b) => a.name.localeCompare(b.name)),
      sourceData: Object.keys(sourceMap).map(k => ({ name: k, value: sourceMap[k] })),
      summary: { totalBookings: bookings.length, totalRevenue, totalDue, netProfit: totalRevenue - totalCommission }
    };
  } catch (e) {
    console.error(e);
    return { summary: { totalRevenue: 0, totalDue: 0, netProfit: 0, totalBookings: 0 }, pnlData: [], sourceData: [] };
  }
});

// --- ✅ EMAIL HANDLER ---
ipcMain.handle('send-email', async (e, data) => {
    // ⚠️ Configure these with your actual App Password
    const user = 'swarnavilla.info@gmail.com'; 
    const pass = 'okzc hnoo lpqa qgon'; // App Password

    const transporter = nodemailer.createTransport({ 
        service: 'gmail', 
        auth: { user, pass } 
    });

    try {
        await transporter.sendMail({ 
            from: `"Swarna Villa" <${user}>`, 
            to: data.to, 
            subject: data.subject, 
            text: data.body, 
            attachments: [{ 
                filename: data.fileName, 
                content: data.pdfBase64.split('base64,').pop(), 
                encoding: 'base64' 
            }] 
        });
        return { success: true };
    } catch (err) { 
        console.error("Email Error:", err);
        return { success: false, error: err.message }; 
    }
});

// --- HELPERS ---
function saveFileLocally(data) {
  try {
    const config = loadConfig();
    const cleanName = (data.name || 'guest').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = data.checkIn ? data.checkIn.split('T')[0] : Date.now();
    const fileName = `${dateStr}_${data.room}_${cleanName}.${data.fileExt || 'png'}`;
    const fullPath = path.join(config.guestDocsPath, fileName);
    
    // Strip header
    const base64Data = data.fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    
    fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    return fullPath;
  } catch (e) { 
    console.error("File Save Error", e); 
    return "Error Saving File"; 
  }
}