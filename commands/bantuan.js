const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bantuan')
        .setDescription('Menampilkan daftar semua perintah yang tersedia.'),
    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📜 Bantuan Bot Naga Koin')
            .setDescription('Berikut adalah daftar perintah yang bisa Anda gunakan:')
            .addFields(
                { name: '`/analisa` `alamat`', value: 'Analisis lengkap (On-chain, Keamanan, & TA) pada token.' },
                { name: '`/waspada` `alamat` `jaringan`', value: 'Audit keamanan cepat pada token di jaringan tertentu.' },
                { name: '`/pantau-mulai` `channel`', value: '**(Admin)** Memulai pemantauan token baru.' },
                { name: '`/pantau-berhenti`', value: '**(Admin)** Menghentikan pemantauan.' },
                { name: '`/bantuan`', value: 'Menampilkan pesan bantuan ini.' }
            )
            .setFooter({ text: 'Bot Naga Koin | Selalu lakukan riset Anda sendiri (DYOR)' });
        await interaction.reply({ embeds: [helpEmbed] });
    },
};