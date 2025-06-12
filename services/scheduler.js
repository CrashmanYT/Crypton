// services/scheduler.js
// Mengelola semua tugas yang berjalan secara berkala (background tasks).

const { alertManager } = require('../database.js');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

const scheduler = {
    /**
     * Memeriksa semua price alert yang aktif di database.
     * @param {import('discord.js').Client} client Instance Discord Client.
     */
    checkPriceAlerts: async (client) => {
        const alerts = alertManager.getAllAlerts();
        if (alerts.length === 0) return;

        console.log(`[Scheduler] Mengecek ${alerts.length} price alert...`);
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
                let message = '';

                // Periksa apakah target harga tercapai
                if (alert.priceAbove && currentPrice >= alert.priceAbove) {
                    triggered = true;
                    message = `naik menembus target Anda **$${alert.priceAbove}**`;
                } else if (alert.priceBelow && currentPrice <= alert.priceBelow) {
                    triggered = true;
                    message = `turun menembus target Anda **$${alert.priceBelow}**`;
                }

                if (triggered) {
                    try {
                        const user = await client.users.fetch(alert.userId);
                        if (user) {
                            const embed = new EmbedBuilder()
                                .setTitle(`🔔 Peringatan Harga Tercapai!`)
                                .setColor(alert.priceAbove ? '#2ECC71' : '#E74C3C')
                                .setDescription(`Token **${alert.tokenSymbol}** telah ${message}.`)
                                .addFields(
                                    { name: 'Harga Saat Ini', value: `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`, inline: true },
                                    { name: 'Token', value: `[${alert.tokenSymbol}](${currentToken.url})`, inline: true },
                                    { name: 'Server Asal', value: alert.guildName, inline: true }
                                )
                                .setFooter({ text: 'Alert ini sekarang telah dihapus.' })
                                .setTimestamp();

                            await user.send({ embeds: [embed] });
                            console.log(`[Scheduler] Mengirim notifikasi alert ID ${alert.id} ke user ${alert.userId}.`);
                        }
                    } catch (dmError) {
                        console.error(`[Scheduler] Gagal mengirim DM ke user ${alert.userId} untuk alert ID ${alert.id}:`, dmError.message);
                    } finally {
                        // Selalu hapus alert dari database setelah terpicu untuk menghindari notifikasi berulang
                        alertManager.removeAlert(alert.id);
                        console.log(`[Scheduler] Menghapus alert ID ${alert.id} dari database.`);
                    }
                }
            }
        } catch (error) {
            console.error("[Scheduler] Gagal mengambil harga untuk price alert:", error.message);
        }
    },

    /**
     * Memeriksa pasangan token baru yang muncul di Dexscreener.
     * @param {import('discord.js').Client} client Instance Discord Client.
     */
    checkNewPairs: async (client) => {
        if (!client.monitoredChannelId || !client.minLiquidity) return;

        try {
            console.log(`[Scheduler] Mengecek pasangan token baru dengan min liq: $${client.minLiquidity}...`);
            const response = await axios.get('https://api.dexscreener.com/latest/dex/search?q=new');
            const pairs = response.data.pairs;
            const channel = await client.channels.fetch(client.monitoredChannelId);
            
            if (!channel) {
                console.log("Channel pantau tidak ditemukan, mematikan interval.");
                clearInterval(client.monitoringInterval);
                client.monitoringInterval = null;
                return;
            }

            for (const pair of pairs) {
                if (!client.lastCheckedTokens.has(pair.pairAddress) && pair.liquidity && pair.liquidity.usd > client.minLiquidity) {
                    const embed = new EmbedBuilder()
                        .setTitle(`🔔 Token Baru Terdeteksi: ${pair.baseToken.name}`)
                        .setURL(pair.url)
                        .setColor('#00FFFF')
                        .addFields(
                            { name: 'Simbol', value: pair.baseToken.symbol, inline: true },
                            { name: 'Likuiditas Awal', value: `$${Number(pair.liquidity.usd).toLocaleString('en-US')}`, inline: true },
                            { name: 'Jaringan', value: pair.chainId, inline: true }
                        )
                        .setFooter({ text: 'Bot Crypton | Pantau Aktif' });
                    await channel.send({ content: `🚨 **Peringatan Token Baru!** (Likuiditas > $${client.minLiquidity.toLocaleString('en-US')}) 🚨`, embeds: [embed] });
                    client.lastCheckedTokens.add(pair.pairAddress);
                }
            }
        } catch (error) {
            console.error("Gagal mengecek token baru:", error.message);
        }
    }
};

module.exports = scheduler;
