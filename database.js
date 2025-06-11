// database.js
const Database = require('better-sqlite3');

// Membuat atau menghubungkan ke file database bernama 'naga_koin.db'
const db = new Database('naga_koin.db');

// Fungsi untuk inisialisasi tabel saat bot pertama kali dijalankan
function setupDatabase() {
    // Tabel untuk menyimpan semua price alerts
    // Menambahkan guildName untuk referensi di DM
    db.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            guildId TEXT NOT NULL,
            guildName TEXT NOT NULL,
            tokenAddress TEXT NOT NULL,
            tokenSymbol TEXT NOT NULL,
            priceAbove REAL,
            priceBelow REAL,
            createdAt INTEGER NOT NULL
        );
    `);
    console.log('[DB] Tabel "alerts" siap digunakan.');
}

// Menyiapkan statement yang sering digunakan untuk performa lebih baik
const insertAlertStmt = db.prepare('INSERT INTO alerts (userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const getAlertsByUserStmt = db.prepare('SELECT * FROM alerts WHERE userId = ? ORDER BY createdAt DESC');
const getAlertByIdAndUserStmt = db.prepare('SELECT * FROM alerts WHERE id = ? AND userId = ?');
const deleteAlertStmt = db.prepare('DELETE FROM alerts WHERE id = ?');
const getAllAlertsStmt = db.prepare('SELECT * FROM alerts');

// Kumpulan fungsi untuk berinteraksi dengan tabel alerts
const alertManager = {
    addAlert: (userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow) => {
        const createdAt = Math.floor(Date.now() / 1000);
        return insertAlertStmt.run(userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow, createdAt);
    },
    getAlertsByUser: (userId) => {
        return getAlertsByUserStmt.all(userId);
    },
    getAlertByIdAndUser: (id, userId) => {
        return getAlertByIdAndUserStmt.get(id, userId);
    },
    removeAlert: (id) => {
        return deleteAlertStmt.run(id);
    },
    getAllAlerts: () => {
        return getAllAlertsStmt.all();
    }
};

module.exports = {
    setupDatabase,
    alertManager
};
