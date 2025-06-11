// events/ready.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🔥 Bot ${client.user.tag} (DB Ready) sudah online!`);
        client.user.setActivity('Memantau Harga Token');

        // ### BARIS BARU: MEMULAI INTERVAL PEMANTAUAN HARGA ###
        // Kita gunakan .bind(client) agar 'this' di dalam fungsi merujuk ke client
        setInterval(client.checkPriceAlerts.bind(client), 60000); // Cek setiap 60 detik
        console.log('[Scheduler] Pemantauan harga aktif, akan berjalan setiap 60 detik.');
    },
};
