// commands/pantau-mulai.js (Versi dengan Perbaikan Error Handling)

const { SlashCommandBuilder, ChannelType } = require('discord.js');

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
            // Jika bukan admin, balas dan hentikan.
            return await interaction.reply({ content: '❌ Perintah ini hanya untuk Administrator.', ephemeral: true });
        }

        if (interaction.client.monitoringInterval) {
            // Jika pemantauan sudah aktif, balas dan hentikan.
            return await interaction.reply({ content: '❌ Pemantauan sudah aktif. Gunakan /pantau-berhenti terlebih dahulu.', ephemeral: true });
        }
        
        // Jika semua pengecekan lolos, baru lanjutkan ke logika utama.
        // Karena logika ini mungkin butuh waktu, kita gunakan deferReply().
        await interaction.deferReply();

        const channel = interaction.options.getChannel('channel');
        const minLiquidity = interaction.options.getInteger('min_liquidity') || 2000;

        // Simpan pengaturan ke client object
        interaction.client.monitoredChannelId = channel.id;
        interaction.client.minLiquidity = minLiquidity;
        
        // Jalankan pemantauan dengan interval
        interaction.client.checkNewPairs();
        interaction.client.monitoringInterval = setInterval(() => interaction.client.checkNewPairs(), 60000 * 5); // Cek setiap 5 menit
        
        // Gunakan editReply() karena kita sudah menggunakan deferReply() sebelumnya.
        await interaction.editReply(`✅ Pemantauan token baru telah dimulai di channel ${channel} dengan minimum likuiditas **$${minLiquidity.toLocaleString('en-US')}**.`);
    },
};