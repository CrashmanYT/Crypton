// events/ready.js
const { Events } = require('discord.js');
const scheduler = require('../services/scheduler.js'); // Import scheduler

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🔥 Bot ${client.user.tag} (Refactored) sudah online!`);
        client.user.setActivity('Menganalisa Pasar');

        // Memulai interval pemantauan harga dari scheduler
        setInterval(() => scheduler.checkPriceAlerts(client), 60000); // Cek harga setiap 60 detik
        // dan sekarang dikelola sepenuhnya oleh /pantau-mulai dan /pantau-berhenti.
        
        console.log('[Scheduler] Pemantauan harga telah aktif.');
    },
};
