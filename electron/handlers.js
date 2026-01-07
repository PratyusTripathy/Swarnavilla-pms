const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs'); // 🔒 Security
const nodemailer = require('nodemailer');
const { getDB } = require('./database');
require('dotenv').config(); // 🔒 Env Variables

// --- CONFIG MANAGEMENT ---
const DEFAULT_CONFIG = {
  guestDocsPath: path.join(app.getPath('userData'), 'Guest_Docs'),
  adminPassword: "admin123" // Fallback only
};

function getConfigFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const configFile = getConfigFile();
    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configFile, 'utf-8')) };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(getConfigFile(), JSON.stringify(cfg, null, 2));
    return true;
  } catch (e) {
    console.error("Config Save Error:", e);
    return false;
  }
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// --- FILE HELPER ---
function saveFileLocally(data) {
  if (!data.fileBase64 || !data.fileExt) return null;
  try {
    const config = loadConfig();
    ensureDirExists(config.guestDocsPath);
    // Sanitize filename
    const cleanName = (data.name || 'guest').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${data.checkIn.split('T')[0]}_${data.room}_${cleanName}.${data.fileExt}`;
    const fullPath = path.join(config.guestDocsPath, fileName);
    
    // Convert Base64 to Buffer
    const buffer = Buffer.from(data.fileBase64.replace(/^data:.*,/, ''), 'base64');
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  } catch (e) { 
    console.error("File Save Error:", e);
    return null; 
  }
}

// --- EXPORTED HANDLERS ---
module.exports = {
  registerHandlers: () => {
    const db = getDB();

    // 1. CONFIG & AUTH
    ipcMain.handle('get-config', () => loadConfig());

    ipcMain.handle('check-password', (e, inputPassword) => {
        const config = loadConfig();
        // 🔒 Support both Hash and Legacy Plain Text during transition
        const isMatch = bcrypt.compareSync(inputPassword, config.adminPassword) || config.adminPassword === inputPassword;
        return isMatch;
    });

    ipcMain.handle('change-password', (e, newPassword) => {
        try {
            const config = loadConfig();
            // 🔒 Hash the password before saving
            const salt = bcrypt.genSaltSync(10);
            config.adminPassword = bcrypt.hashSync(newPassword, salt);
            saveConfig(config);
            return { success: true };
        } catch(e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('update-guest-doc-path', (e, newPath) => {
        ensureDirExists(newPath);
        const config = loadConfig();
        config.guestDocsPath = newPath;
        saveConfig(config);
        return { success: true };
    });

    // 2. ROOMS
    ipcMain.handle('get-rates', () => {
        const rows = db.prepare('SELECT * FROM rates ORDER BY room_no ASC').all();
        const ratesObj = {};
        rows.forEach(row => { ratesObj[row.room_no] = { type: row.room_type, rate: row.rate }; });
        return ratesObj;
    });

    ipcMain.handle('add-room', (e, r) => {
        try { db.prepare('INSERT INTO rates VALUES (?, ?, ?)').run(r.room_no, r.room_type, r.rate); return { success: true }; } 
        catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('update-room', (e, r) => {
        db.prepare('UPDATE rates SET room_type=?, rate=? WHERE room_no=?').run(r.room_type, r.rate, r.room_no); return { success: true };
    });

    ipcMain.handle('delete-room', (e, room_no) => {
        db.prepare('DELETE FROM rates WHERE room_no=?').run(room_no); return { success: true };
    });

    // 3. BOOKINGS
    ipcMain.handle('get-bookings', () => db.prepare('SELECT * FROM bookings ORDER BY id DESC').all());

    ipcMain.handle('add-booking', (e, data) => {
        try {
            const savedPath = saveFileLocally(data);
            // 🔒 Parameterized Query (Safe from SQL Injection)
            const stmt = db.prepare(`INSERT INTO bookings (room, name, mobile, email, idType, idNumber, fileBase64, checkIn, checkOut, days, refBy, commission, rent, advance, total, due, paymentMode, paymentRef) VALUES (@room, @name, @mobile, @email, @idType, @idNumber, @fileBase64, @checkIn, @checkOut, @days, @refBy, @commission, @rent, @advance, @total, @due, @paymentMode, @paymentRef)`);
            stmt.run({ ...data, fileBase64: savedPath || "No File" });
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('update-booking', (e, data) => {
        try {
            let savedPath = data.savedFilePath;
            // Only overwrite file if a new one (Base64) is provided
            if (data.fileBase64 && data.fileBase64.startsWith('data:')) {
                const newPath = saveFileLocally(data);
                if (newPath) savedPath = newPath;
            }
            const stmt = db.prepare(`UPDATE bookings SET room=@room, name=@name, mobile=@mobile, email=@email, idType=@idType, idNumber=@idNumber, fileBase64=@fileBase64, checkIn=@checkIn, checkOut=@checkOut, days=@days, refBy=@refBy, commission=@commission, rent=@rent, advance=@advance, total=@total, due=@due, paymentMode=@paymentMode, paymentRef=@paymentRef WHERE id=@id`);
            stmt.run({ ...data, fileBase64: savedPath });
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('delete-booking', (e, id) => {
        db.prepare('DELETE FROM bookings WHERE id=?').run(id); return { success: true };
    });

    // 4. DASHBOARD
    ipcMain.handle('get-dashboard-stats', () => {
        try {
            const bookings = db.prepare("SELECT * FROM bookings").all();
            const pnlMap = {}; const sourceMap = {};
            let totalRevenue = 0, totalDue = 0, totalCommission = 0;

            bookings.forEach(b => {
                const date = new Date(b.checkIn);
                if (!isNaN(date)) {
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    if (!pnlMap[key]) pnlMap[key] = { name: key, revenue: 0, commission: 0, profit: 0 };
                    const rev = parseFloat(b.total) || 0; const comm = parseFloat(b.commission) || 0;
                    pnlMap[key].revenue += rev; pnlMap[key].commission += comm; pnlMap[key].profit += (rev - comm);
                }
                const source = b.refBy ? b.refBy.split(' - ')[0] : 'Direct';
                sourceMap[source] = (sourceMap[source] || 0) + 1;
                totalRevenue += (parseFloat(b.total) || 0);
                totalDue += (parseFloat(b.due) || 0);
                totalCommission += (parseFloat(b.commission) || 0);
            });
            return {
                pnlData: Object.values(pnlMap).sort((a, b) => a.name.localeCompare(b.name)),
                sourceData: Object.keys(sourceMap).map(k => ({ name: k, value: sourceMap[k] })),
                summary: { totalBookings: bookings.length, totalRevenue, totalDue, netProfit: totalRevenue - totalCommission }
            };
        } catch (e) { return {}; }
    });

    // 5. EMAIL
    ipcMain.handle('send-email', async (e, data) => {
        // 🔒 Use Environment Variables
        const user = process.env.EMAIL_USER || 'swarnavilla.info@gmail.com'; 
        const pass = process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD_HERE';

        const transporter = nodemailer.createTransport({ 
            host: 'smtp.gmail.com', port: 587, secure: false, 
            auth: { user, pass } 
        });

        try {
            await transporter.sendMail({ 
                from: `"Swarna Villa" <${user}>`, 
                to: data.to, 
                subject: data.subject, 
                text: data.body, 
                attachments: [{ filename: data.fileName, content: data.pdfBase64.split('base64,').pop(), encoding: 'base64' }] 
            });
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });
  }
};