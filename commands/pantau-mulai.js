const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pantau-mulai')
        .setDescription('Memulai pemantauan token baru.')
        .addChannelOption(option => option.setName('channel').setDescription('Channel untuk notifikasi').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(0),
    async execute(interaction) {
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({ content: '❌ Perintah ini hanya untuk Administrator.', ephemeral: true });
        }
        if (interaction.client.monitoringInterval) {
            return await interaction.reply({ content: '❌ Pemantauan sudah aktif.', ephemeral: true });
        }
        const channel = interaction.options.getChannel('channel');
        interaction.client.monitoredChannelId = channel.id;
        interaction.client.checkNewPairs();
        interaction.client.monitoringInterval = setInterval(() => interaction.client.checkNewPairs(), 60000 * 5);
        await interaction.reply(`✅ Pemantauan token baru telah dimulai di channel ${channel}.`);
    },
};