// database.js
const Database = require('better-sqlite3');

// Membuat atau menghubungkan ke file database.
// Untuk pengujian, ini akan menjadi database in-memory.
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

// Kumpulan fungsi untuk berinteraksi dengan tabel alerts
// PERBAIKAN: Menyiapkan statement di dalam setiap fungsi untuk memastikan
// tabel sudah ada sebelum statement di-prepare.
const alertManager = {
    addAlert: (userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow) => {
        const stmt = db.prepare('INSERT INTO alerts (userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const createdAt = Math.floor(Date.now() / 1000);
        return stmt.run(userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow, createdAt);
    },
    getAlertsByUser: (userId) => {
        const stmt = db.prepare('SELECT * FROM alerts WHERE userId = ? ORDER BY createdAt DESC');
        return stmt.all(userId);
    },
    getAlertByIdAndUser: (id, userId) => {
        const stmt = db.prepare('SELECT * FROM alerts WHERE id = ? AND userId = ?');
        return stmt.get(id, userId);
    },
    removeAlert: (id) => {
        const stmt = db.prepare('DELETE FROM alerts WHERE id = ?');
        return stmt.run(id);
    },
    getAllAlerts: () => {
        const stmt = db.prepare('SELECT * FROM alerts');
        return stmt.all();
    }
};

module.exports = {
    db, // Ekspor db jika diperlukan di tempat lain
    setupDatabase,
    alertManager
};
