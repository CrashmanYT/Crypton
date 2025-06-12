// database.js
const Database = require('better-sqlite3');

const db = new Database('naga_koin.db');

function setupDatabase() {
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
    
    // --- TAMBAHKAN SKEMA BARU DI SINI ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS pro_traders (
            walletAddress TEXT PRIMARY KEY,
            network TEXT NOT NULL,
            pnl REAL,
            winrate REAL,
            lastChecked INTEGER NOT NULL,
            note TEXT
        );
    `);

    console.log('[DB] Tabel "alerts" dan "pro_traders" siap digunakan.');
}

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

// --- TAMBAHKAN MANAGER BARU UNTUK PRO TRADER ---
const proTraderManager = {
    // Fungsi untuk menambah atau memperbarui data trader
    upsertTrader: (walletAddress, network, pnl, winrate, note = '') => {
        const stmt = db.prepare(`
            INSERT INTO pro_traders (walletAddress, network, pnl, winrate, lastChecked, note)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(walletAddress) DO UPDATE SET
                pnl = excluded.pnl,
                winrate = excluded.winrate,
                lastChecked = excluded.lastChecked
        `);
        return stmt.run(walletAddress, network, pnl, winrate, Math.floor(Date.now() / 1000), note);
    },
    getTraders: (network) => {
        const stmt = db.prepare('SELECT * FROM pro_traders WHERE network = ? ORDER BY pnl DESC');
        return stmt.all(network);
    }
};

module.exports = {
    db,
    setupDatabase,
    alertManager,
    proTraderManager // Ekspor manager baru
};
