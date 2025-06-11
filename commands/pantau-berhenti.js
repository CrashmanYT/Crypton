const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pantau-berhenti')
        .setDescription('Menghentikan pemantauan token baru.')
        .setDefaultMemberPermissions(0),
    async execute(interaction) {
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({ content: '❌ Perintah ini hanya untuk Administrator.', ephemeral: true });
        }
        if (!interaction.client.monitoringInterval) {
            return await interaction.reply({ content: '❌ Tidak ada pemantauan yang sedang aktif.', ephemeral: true });
        }
        clearInterval(interaction.client.monitoringInterval);
        interaction.client.monitoringInterval = null;
        interaction.client.monitoredChannelId = null;
        interaction.client.lastCheckedTokens.clear();
        await interaction.reply('✅ Pemantauan token baru telah dihentikan.');
    },
};