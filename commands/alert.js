// commands/alert.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { alertManager } = require('../database.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alert')
        .setDescription('Mengelola peringatan harga token.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Mengatur peringatan harga baru.')
                .addStringOption(option => option.setName('alamat').setDescription('Alamat kontrak token').setRequired(true))
                .addNumberOption(option => option.setName('harga_di_atas').setDescription('Kirim notifikasi jika harga NAIK ke nilai ini').setRequired(false))
                .addNumberOption(option => option.setName('harga_di_bawah').setDescription('Kirim notifikasi jika harga TURUN ke nilai ini').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Melihat semua peringatan harga aktif Anda.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Menghapus peringatan harga.')
                .addIntegerOption(option => option.setName('id').setDescription('ID dari alert yang ingin dihapus').setRequired(true))
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const guildName = interaction.guild.name; // Ambil nama server

        if (subcommand === 'set') {
            await interaction.deferReply({ ephemeral: true });

            const tokenAddress = interaction.options.getString('alamat');
            const priceAbove = interaction.options.getNumber('harga_di_atas');
            const priceBelow = interaction.options.getNumber('harga_di_bawah');

            if (!priceAbove && !priceBelow) {
                return await interaction.editReply('❌ Anda harus mengisi setidaknya salah satu opsi: `harga_di_atas` atau `harga_di_bawah`.');
            }
            if (priceAbove && priceBelow && priceAbove <= priceBelow) {
                return await interaction.editReply('❌ `harga_di_atas` harus lebih besar dari `harga_di_bawah`.');
            }

            try {
                // Verifikasi token dan ambil simbolnya
                const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
                const pair = response.data.pairs ? response.data.pairs[0] : null;

                if (!pair) {
                    return await interaction.editReply(`❌ Token dengan alamat \`${tokenAddress}\` tidak ditemukan.`);
                }
                const tokenSymbol = pair.baseToken.symbol;
                const currentPrice = parseFloat(pair.priceUsd);

                if (priceAbove && priceAbove <= currentPrice) {
                     return await interaction.editReply(`❌ \`harga_di_atas\` ($${priceAbove}) harus lebih tinggi dari harga saat ini ($${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 8})}).`);
                }
                if (priceBelow && priceBelow >= currentPrice) {
                     return await interaction.editReply(`❌ \`harga_di_bawah\` ($${priceBelow}) harus lebih rendah dari harga saat ini ($${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 8})}).`);
                }

                alertManager.addAlert(userId, guildId, guildName, tokenAddress, tokenSymbol, priceAbove, priceBelow);
                await interaction.editReply(`✅ Peringatan harga untuk **${tokenSymbol}** telah berhasil diatur! Anda akan menerima DM saat target tercapai.`);

            } catch (error) {
                await interaction.editReply('❌ Gagal memverifikasi token. Pastikan alamat kontrak benar.');
            }
        }
        else if (subcommand === 'list') {
            const userAlerts = alertManager.getAlertsByUser(userId);
            if (userAlerts.length === 0) {
                return await interaction.reply({ content: 'Anda tidak memiliki peringatan harga aktif.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔔 Peringatan Harga Aktif Anda')
                .setDescription('Gunakan `/alert remove id:[ID]` untuk menghapus.')
                .setColor('#FFD700');
            
            for (const alert of userAlerts) {
                let target = '';
                if (alert.priceAbove) target += `Naik ke $${alert.priceAbove}`;
                if (alert.priceBelow) target += `${alert.priceAbove ? ' atau ' : ''}Turun ke $${alert.priceBelow}`;
                
                embed.addFields({
                    name: `ID: ${alert.id}  —  ${alert.tokenSymbol}`,
                    value: `**Target:** ${target}`
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        else if (subcommand === 'remove') {
            const alertId = interaction.options.getInteger('id');
            const alert = alertManager.getAlertByIdAndUser(alertId, userId);

            if (!alert) {
                return await interaction.reply({ content: `❌ Alert dengan ID \`${alertId}\` tidak ditemukan atau bukan milik Anda.`, ephemeral: true });
            }

            alertManager.removeAlert(alertId);
            await interaction.reply({ content: `✅ Alert ID \`${alertId}\` untuk token **${alert.tokenSymbol}** telah dihapus.`, ephemeral: true });
        }
    },
};
