// commands/pantau-mulai.js (Versi Refactored & Diperbaiki)

const { SlashCommandBuilder, ChannelType } = require('discord.js');
const scheduler = require('../services/scheduler.js'); // Import scheduler

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pantau-mulai')
        .setDescription('Memulai pemantauan token baru dengan kriteria tertentu.')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel untuk mengirim notifikasi token baru')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addIntegerOption(option =>
            option.setName('min_liquidity')
                .setDescription('Opsional: Minimum likuiditas (USD) untuk notifikasi. Default: 2000.')
                .setRequired(false)
                .setMinValue(0)),
    async execute(interaction) {
        // Lakukan semua pengecekan di awal
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({ content: '❌ Perintah ini hanya untuk Administrator.', ephemeral: true });
        }

        if (interaction.client.monitoringInterval) {
            return await interaction.reply({ content: '❌ Pemantauan sudah aktif. Gunakan /pantau-berhenti terlebih dahulu.', ephemeral: true });
        }
        
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const minLiquidity = interaction.options.getInteger('min_liquidity') || 2000;

        // Simpan pengaturan ke client object
        interaction.client.monitoredChannelId = channel.id;
        interaction.client.minLiquidity = minLiquidity;
        
        // Jalankan pemantauan pertama kali secara langsung
        scheduler.checkNewPairs(interaction.client);

        // ### PERBAIKAN UTAMA DI SINI ###
        // Memulai interval dan menyimpan ID-nya ke client object
        interaction.client.monitoringInterval = setInterval(() => scheduler.checkNewPairs(interaction.client), 300000); // Cek setiap 5 menit
        
        console.log('[Scheduler] Pemantauan token baru telah dimulai.');
        
        await interaction.editReply(`✅ Pemantauan token baru telah dimulai di channel ${channel} dengan minimum likuiditas **$${minLiquidity.toLocaleString('en-US')}**.`);
    },
};
