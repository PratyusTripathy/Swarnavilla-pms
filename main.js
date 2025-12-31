const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const nodemailer = require('nodemailer'); // Requires: npm install nodemailer

let mainWindow;
let db;

// --- 1. STORAGE & DATABASE SETUP ---
// We use 'userData' so files persist even if you move the app folder.
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'swarna_pms.db');
const uploadDir = path.join(userDataPath, 'Guest_Docs');

// Ensure the Guest_Docs folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

console.log('Database Path:', dbPath);
console.log('File Storage Path:', uploadDir);

function initDB() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Database connection failed:', err);
    } else {
      console.log('Connected to SQLite database.');
      createTable();
    }
  });
}

function createTable() {
  // Includes all fields: Guest Info, Financials, Payment Details, and Dates
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    name TEXT,
    mobile TEXT,
    email TEXT,
    idType TEXT,
    idNumber TEXT,
    fileBase64 TEXT,  -- Stores the File Path on disk
    checkIn TEXT,
    checkOut TEXT,    -- Added CheckOut
    days INTEGER,
    refBy TEXT,       -- Added Source
    commission INTEGER, -- Added Commission
    rent INTEGER,
    advance INTEGER,
    total INTEGER,
    due INTEGER,
    paymentMode TEXT, -- Added Payment Mode
    paymentRef TEXT,  -- Added Transaction ID
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

// --- 2. WINDOW CREATION ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: "Swarna Villa PMS",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, // Secure bridge
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the React App
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'dist/index.html')}`;
  mainWindow.loadURL(startUrl);

  // DevTools disabled by default for cleaner UI. 
  // Uncomment the line below to debug.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  initDB();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- 3. HELPER FUNCTIONS ---

// Saves a Base64 file to disk with the specific naming convention: Room_Guest_Date_ID
function saveFileLocally(data) {
  if (!data.fileBase64 || !data.fileExt) return null;

  try {
    const cleanName = data.name.replace(/[^a-zA-Z0-9]/g, '_'); // Remove special chars
    const cleanDate = data.checkIn.replace(/-/g, ''); // Format: 20251231
    
    // Naming Format: 101_Pratyus_20251231_Aadhar.jpg
    const fileName = `${data.room}_${cleanName}_${cleanDate}_${data.idType}.${data.fileExt}`;
    const fullPath = path.join(uploadDir, fileName);

    // Clean Base64 string and save
    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "").replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(fullPath, buffer);
    return fullPath; // Return the path to save in DB
  } catch (e) {
    console.error("File save error:", e);
    return null;
  }
}

// --- 4. API HANDLERS (React talks to these) ---

// GET ALL BOOKINGS
ipcMain.handle('get-bookings', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM bookings ORDER BY id DESC", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

// CREATE BOOKING
ipcMain.handle('add-booking', async (event, data) => {
  // 1. Save File
  const savedFilePath = saveFileLocally(data) || "No File";

  // 2. Save to DB
  const sql = `INSERT INTO bookings (room, name, mobile, email, idType, idNumber, fileBase64, checkIn, checkOut, days, refBy, commission, rent, advance, total, due, paymentMode, paymentRef) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  
  const params = [
    data.room, data.name, data.mobile, data.email, 
    data.idType, data.idNumber, savedFilePath, 
    data.checkIn, data.checkOut, data.days, 
    data.refBy, data.commission, 
    data.rent, data.advance, data.total, data.due, 
    data.paymentMode, data.paymentRef
  ];
  
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, savedFilePath });
    });
  });
});

// UPDATE BOOKING
ipcMain.handle('update-booking', async (event, data) => {
  // 1. Handle File (Only overwrite if a new file is provided)
  let savedFilePath = data.savedFilePath; // Default to existing path
  if (data.fileBase64 && data.fileExt) {
    savedFilePath = saveFileLocally(data);
  }

  // 2. Update DB
  const sql = `UPDATE bookings SET 
    room=?, name=?, mobile=?, email=?, 
    idType=?, idNumber=?, fileBase64=?, 
    checkIn=?, checkOut=?, days=?, 
    refBy=?, commission=?, 
    rent=?, advance=?, total=?, due=?, 
    paymentMode=?, paymentRef=? 
    WHERE id=?`;

  const params = [
    data.room, data.name, data.mobile, data.email,
    data.idType, data.idNumber, savedFilePath,
    data.checkIn, data.checkOut, data.days,
    data.refBy, data.commission,
    data.rent, data.advance, data.total, data.due,
    data.paymentMode, data.paymentRef,
    data.id
  ];

  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ success: true, savedFilePath });
    });
  });
});

// DELETE BOOKING
ipcMain.handle('delete-booking', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM bookings WHERE id = ?", id, function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});

// OPEN FILE (Opens ID scan in default image viewer/PDF reader)
ipcMain.handle('open-file', async (event, filePath) => {
  if (filePath && filePath !== "No File") {
    await shell.openPath(filePath);
  }
});

// SEND EMAIL (Robust Version with your Credentials)
ipcMain.handle('send-email', async (event, data) => {
  const { to, subject, body, pdfBase64, fileName } = data;

  console.log("Attempting to send email to:", to);

  // --- CONFIGURATION ---
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',  // Use specific Gmail host
    port: 465,               // Secure Port
    secure: true,            // Use SSL
    auth: {
      user: 'swarnavilla.info@gmail.com', // Your Email
      pass: 'okzc hnoo lpqa qgon'         // Your App Password
    }
  });

  // Prepare attachment from Base64
  const cleanBase64 = pdfBase64.split('base64,').pop();

  const mailOptions = {
    // The 'from' address matches your authenticated email
    from: '"Swarna Villa PMS" <swarnavilla.info@gmail.com>', 
    to: to,
    subject: subject,
    text: body,
    attachments: [
      {
        filename: fileName,
        content: cleanBase64,
        encoding: 'base64'
      }
    ]
  };

  try {
    // Verify connection before sending
    await transporter.verify();
    console.log("✅ Connection Verified. Sending...");

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully ID:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("❌ EMAIL FAILED:", error);
    return { success: false, error: error.message };
  }
});