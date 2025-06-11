// index.js (Versi dengan Database & Fungsi Price Alert)
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { setupDatabase, alertManager } = require('./database.js'); // Import dari database.js
const axios = require('axios');

// PANGGIL FUNGSI SETUP DATABASE SEKALI SAAT STARTUP
setupDatabase();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // INTENT BARU untuk bisa mengirim DM
    ]
});

// === Command Handler (Tidak ada perubahan) ===
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// === Event Handler (Tidak ada perubahan) ===
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// === State & Fungsi untuk Fitur Pantau (Tidak ada perubahan) ===
client.monitoringInterval = null;
client.monitoredChannelId = null;
client.minLiquidity = 2000; // Nilai default
client.lastCheckedTokens = new Set();
client.checkNewPairs = async function() { /* ... kode checkNewPairs Anda tetap sama ... */ };

// ### FUNGSI BARU: PEMANTAUAN HARGA ###
// Kita lampirkan ke client agar bisa diakses dari file lain
client.checkPriceAlerts = async function() {
    const alerts = alertManager.getAllAlerts();
    if (alerts.length === 0) return;

    console.log(`[Price Alert] Mengecek ${alerts.length} alert...`);
    const uniqueTokens = [...new Set(alerts.map(a => a.tokenAddress))];

    try {
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueTokens.join(',')}`);
        const priceData = response.data.pairs;
        if (!priceData) return;

        for (const alert of alerts) {
            const currentToken = priceData.find(p => p.baseToken.address.toLowerCase() === alert.tokenAddress.toLowerCase());
            if (!currentToken) continue;

            const currentPrice = parseFloat(currentToken.priceUsd);
            let triggered = false;
            let embed;

            if (alert.priceAbove && currentPrice >= alert.priceAbove) {
                triggered = true;
                embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('📈 Peringatan Harga Tercapai!')
                    .setDescription(`Harga **${alert.tokenSymbol}** telah mencapai target Anda!`)
                    .addFields(
                        { name: 'Target Harga', value: `Diatas $${alert.priceAbove}` },
                        { name: 'Harga Saat Ini', value: `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 8})}` }
                    )
                    .setURL(currentToken.url)
                    .setFooter({ text: `Alert diatur di server: ${alert.guildName}` });
            }
            else if (alert.priceBelow && currentPrice <= alert.priceBelow) {
                triggered = true;
                embed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('📉 Peringatan Harga Tercapai!')
                    .setDescription(`Harga **${alert.tokenSymbol}** telah mencapai target Anda!`)
                    .addFields(
                        { name: 'Target Harga', value: `Dibawah $${alert.priceBelow}` },
                        { name: 'Harga Saat Ini', value: `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 8})}` }
                    )
                    .setURL(currentToken.url)
                    .setFooter({ text: `Alert diatur di server: ${alert.guildName}` });
            }

            if (triggered) {
                try {
                    const user = await this.users.fetch(alert.userId);
                    await user.send({ embeds: [embed] });
                    alertManager.removeAlert(alert.id);
                    console.log(`[Price Alert] Alert ID ${alert.id} terpicu, notifikasi terkirim, dan alert dihapus.`);
                } catch (dmError) {
                    console.error(`Gagal mengirim DM ke user ${alert.userId}:`, dmError);
                }
            }
        }
    } catch (error) {
        console.error("[Price Alert] Gagal mengambil harga dari Dexscreener:", error.message);
    }
};

client.login(process.env.DISCORD_TOKEN);
