const { app, BrowserWindow, ipcMain, Menu } = require('electron'); //
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const https = require('https'); 

let mainWindow;
let db;

/* ------------------------------------------------------------------
   0. CONFIG & PATH MANAGEMENT (Same as before)
------------------------------------------------------------------- */
const DEFAULT_CONFIG = {
  guestDocsPath: path.join(app.getPath('userData'), 'Guest_Docs'),
  adminPassword: "admin123",
  otaApiKey: "DEMO_KEY",
  otaHotelId: "DEMO_ID"
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
   1. DATA PATHS & DB INIT (Same as before)
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

  // Migration for fileExt
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
   2. WINDOW & MENU (Same as before)
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

  const template = [
    { label: 'File', submenu: [ { role: 'quit' } ] },
    { label: 'Edit', submenu: [ { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' } ] },
    { label: 'View', submenu: [ { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' } ] },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => mainWindow.webContents.send('navigate-to', 'help') },
        { label: 'FAQs', click: () => mainWindow.webContents.send('navigate-to', 'help') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  const cfg = loadConfig();
  ensureDirExists(cfg.guestDocsPath); 
  initDB();
  createWindow();
});

/* ------------------------------------------------------------------
   3. IPC HANDLERS (Same as before)
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
        let finalPath = data.savedFilePath || data.fileBase64; 
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
      const total = parseFloat(b.total) || 0;
      const due = parseFloat(b.due) || 0;
      const commission = parseFloat(b.commission) || 0;
      const profit = total - commission;

      totalRevenue += total;
      totalDue += due;
      totalCommission += commission;

      let source = 'Direct';
      if (b.refBy && b.refBy.includes('-')) source = b.refBy.split('-')[0].trim();
      else if (b.refBy) source = b.refBy;
      sourceMap[source] = (sourceMap[source] || 0) + 1;

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

// --- EMAIL ---
ipcMain.handle('send-email', async (e, data) => {
    const user = 'swarnavilla.info@gmail.com'; 
    const pass = 'okzc hnoo lpqa qgon'; 

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

function saveFileLocally(data) {
  try {
    const config = loadConfig();
    const cleanName = (data.name || 'guest').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = data.checkIn ? data.checkIn.split('T')[0] : Date.now();
    const fileName = `${dateStr}_${data.room}_${cleanName}.${data.fileExt || 'png'}`;
    const fullPath = path.join(config.guestDocsPath, fileName);
    const base64Data = data.fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    return fullPath;
  } catch (e) { 
    console.error("File Save Error", e); 
    return "Error Saving File"; 
  }
}

/* ------------------------------------------------------------------
   4. OTA SYNC ENGINE (DATA NORMALIZATION)
------------------------------------------------------------------- */

// ✅ THE MAPPER: Converts messy external data into ONE standard format
function normalizeBookingData(rawBooking, source) {
    let standard = {
        ota_id: '',
        guest_name: '',
        phone: '',
        room_type: '',
        check_in: '',
        check_out: '',
        price: 0,
        source: source
    };

    if (source === 'MakeMyTrip') {
        // MMT Structure (Example)
        standard.ota_id = rawBooking.mmt_booking_id;
        standard.guest_name = rawBooking.guest_details.fullName;
        standard.phone = rawBooking.guest_details.mobile;
        standard.room_type = rawBooking.hotel_details.room_name;
        standard.check_in = rawBooking.checkin_date; // YYYY-MM-DD
        standard.check_out = rawBooking.checkout_date;
        standard.price = rawBooking.payment.final_amount;
    } 
    else if (source === 'Booking.com') {
        // Booking.com Structure (Example)
        standard.ota_id = rawBooking.reservation_id;
        standard.guest_name = rawBooking.customer.name;
        standard.phone = rawBooking.customer.phone;
        standard.room_type = rawBooking.room.description;
        standard.check_in = rawBooking.arrival_date;
        standard.check_out = rawBooking.departure_date;
        standard.price = rawBooking.price.total_gross_amount;
    }
    else {
        // Default / Agoda / Others
        standard = { ...standard, ...rawBooking };
    }

    return standard;
}

function fetchExternalBookings(apiKey, hotelId) {
    return new Promise((resolve) => {
        // Simulated API Response with DIFFERENT structures
        setTimeout(() => {
            const rawResponse = {
                // Mocking a multi-source response
                mmt_data: [
                    {
                        mmt_booking_id: "MMT-998877",
                        guest_details: { fullName: "Rahul OTA Demo", mobile: "9876543210" },
                        hotel_details: { room_name: "Super Deluxe Room" },
                        checkin_date: "2025-11-15",
                        checkout_date: "2025-11-17",
                        payment: { final_amount: 6000 }
                    }
                ],
                booking_com_data: [
                    {
                        reservation_id: "BK-112233",
                        customer: { name: "Sarah Smith", phone: "5550123456" },
                        room: { description: "Swarna Family Suite" },
                        arrival_date: "2025-12-01",
                        departure_date: "2025-12-05",
                        price: { total_gross_amount: 15000 }
                    }
                ]
            };

            // Process and Normalize right here
            const normalizedList = [];
            
            rawResponse.mmt_data.forEach(b => {
                normalizedList.push(normalizeBookingData(b, 'MakeMyTrip'));
            });

            rawResponse.booking_com_data.forEach(b => {
                normalizedList.push(normalizeBookingData(b, 'Booking.com'));
            });

            resolve(normalizedList);
        }, 1500);
    });
}

ipcMain.handle('sync-ota-bookings', async () => {
    try {
        const config = loadConfig();
        const apiKey = config.otaApiKey || "DEMO"; 
        const hotelId = config.otaHotelId || "DEMO";

        console.log("🔄 Starting OTA Sync...");
        
        // 1. Fetch & Normalize Data
        const cleanBookings = await fetchExternalBookings(apiKey, hotelId);
        
        let newCount = 0;
        const stmtCheck = db.prepare('SELECT id FROM bookings WHERE paymentRef = ?');
        
        const insertTx = db.transaction((bookings) => {
            for (const b of bookings) {
                // 2. Check if OTA ID exists in DB
                const exists = stmtCheck.get(b.ota_id);
                if (!exists) {
                    const d1 = new Date(b.check_in);
                    const d2 = new Date(b.check_out);
                    const days = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) || 1;

                    // 3. Set to Unassigned
                    const assignedRoom = `Unassigned (${b.room_type})`; 

                    db.prepare(`
                        INSERT INTO bookings (
                            room, name, mobile, email, idType, idNumber, fileBase64, fileExt,
                            checkIn, checkOut, days, refBy, commission, rent, 
                            advance, total, due, paymentMode, paymentRef
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        assignedRoom,
                        b.guest_name,
                        b.phone,
                        "", 
                        "OTA",
                        b.ota_id,
                        "No File", "png",
                        b.check_in + "T12:00",
                        b.check_out + "T11:00",
                        days,
                        `OTA - ${b.source}`,
                        0,
                        b.price / days,
                        b.price,
                        b.price,
                        0,
                        "Online",
                        b.ota_id
                    );
                    newCount++;
                }
            }
        });

        insertTx(cleanBookings);
        return { success: true, added: newCount };

    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, error: error.message };
    }
});

/* ------------------------------------------------------------------
   5. BACKUP & EXPORT SYSTEM
------------------------------------------------------------------- */
const { dialog } = require('electron');

// A. FULL SYSTEM BACKUP (.db copy)
ipcMain.handle('backup-system', async () => {
    try {
        const config = loadConfig();
        const defaultPath = path.join(config.guestDocsPath, `SwarnaPMS_Backup_${Date.now()}.db`);
        
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save System Backup',
            defaultPath: defaultPath,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (!filePath) return { success: false, msg: "Cancelled" };

        // Flush WAL to ensure .db is complete before copying
        db.pragma('wal_checkpoint(RESTART)');
        
        fs.copyFileSync(dbPath, filePath);
        return { success: true, path: filePath };
    } catch (error) {
        console.error("Backup Error:", error);
        return { success: false, error: error.message };
    }
});

// B. DATA EXPORT (JSON/CSV)
ipcMain.handle('export-data', async (e, format) => {
    try {
        const bookings = db.prepare('SELECT * FROM bookings').all();
        const config = loadConfig();
        const timestamp = new Date().toISOString().split('T')[0];
        const defaultPath = path.join(config.guestDocsPath, `Swarna_Export_${timestamp}.${format}`);

        const { filePath } = await dialog.showSaveDialog({
            title: `Export Data as ${format.toUpperCase()}`,
            defaultPath: defaultPath,
            filters: [{ name: format.toUpperCase(), extensions: [format] }]
        });

        if (!filePath) return { success: false, msg: "Cancelled" };

        let content = '';
        if (format === 'json') {
            content = JSON.stringify(bookings, null, 2);
        } else {
            // CSV Generation
            const headers = Object.keys(bookings[0] || {}).join(',');
            const rows = bookings.map(b => Object.values(b).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
            content = [headers, ...rows].join('\n');
        }

        fs.writeFileSync(filePath, content);
        return { success: true, path: filePath };
    } catch (error) {
        console.error("Export Error:", error);
        return { success: false, error: error.message };
    }
});