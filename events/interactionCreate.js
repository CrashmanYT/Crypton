// events/interactionCreate.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Tidak ada perintah yang cocok dengan ${interaction.commandName}.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error saat menjalankan perintah ${interaction.commandName}`);
            console.error(error);
            if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'Terjadi kesalahan saat menjalankan perintah ini!', ephemeral: true });
			} else {
				await interaction.reply({ content: 'Terjadi kesalahan saat menjalankan perintah ini!', ephemeral: true });
			}
        }
    },
};