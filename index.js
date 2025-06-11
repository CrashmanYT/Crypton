// index.js (Versi Baru)
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});

// === Command Handler ===
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// === Event Handler ===
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

// === State untuk Fitur Pantau ===
// Kita lampirkan ke client agar bisa diakses dari file lain
client.monitoringInterval = null;
client.monitoredChannelId = null;
client.lastCheckedTokens = new Set();
client.checkNewPairs = async function() {
    // Pastikan ada channel yang dipantau dan ada nilai minLiquidity
    if (!this.monitoredChannelId || !this.minLiquidity) return;

    try {
        const axios = require('axios');
        console.log(`[${new Date().toLocaleString()}] Mengecek pasangan token baru dengan min liq: $${this.minLiquidity}...`);
        const response = await axios.get('https://api.dexscreener.com/latest/dex/search?q=new');
        const pairs = response.data.pairs;
        const channel = await this.channels.fetch(this.monitoredChannelId);
        
        if (!channel) {
            console.log("Channel pantau tidak ditemukan, mematikan interval.");
            clearInterval(this.monitoringInterval);
            return;
        }

        for (const pair of pairs) {
            // ### PERUBAHAN UTAMA DI SINI ###
            // Menggunakan `this.minLiquidity` sebagai filter, bukan angka 2000
            if (!this.lastCheckedTokens.has(pair.pairAddress) && pair.liquidity && pair.liquidity.usd > this.minLiquidity) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(`🔔 Token Baru Terdeteksi: ${pair.baseToken.name}`)
                    .setURL(pair.url)
                    .setColor('#00FFFF')
                    .addFields(
                        { name: 'Simbol', value: pair.baseToken.symbol, inline: true },
                        { name: 'Likuiditas Awal', value: `$${Number(pair.liquidity.usd).toLocaleString('en-US')}`, inline: true },
                        { name: 'Jaringan', value: pair.chainId, inline: true }
                    )
                    .setFooter({ text: 'Bot Naga Koin | Pantau Aktif' });
                await channel.send({ content: `🚨 **Peringatan Token Baru!** (Likuiditas > $${this.minLiquidity.toLocaleString('en-US')}) 🚨`, embeds: [embed] });
                this.lastCheckedTokens.add(pair.pairAddress);
            }
        }
    } catch (error) {
        console.error("Gagal mengecek token baru:", error.message);
    }
}

client.login(process.env.DISCORD_TOKEN);