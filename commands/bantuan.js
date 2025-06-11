
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bantuan')
        .setDescription('Menampilkan daftar semua perintah yang tersedia.'),
    async execute(interaction) {
        try {
            const helpEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('� Bantuan Bot Crypton')
                .setDescription('Berikut adalah daftar perintah yang tersedia secara otomatis:')
                .setFooter({ text: 'Bot Crypton | Selalu lakukan riset Anda sendiri (DYOR)' })
                .setTimestamp();

            // Ambil semua perintah dari client.commands
            const commands = interaction.client.commands;

            // Lakukan looping pada setiap perintah dan tambahkan sebagai field di embed
            commands.forEach(command => {
                // Kita akan coba membuat format parameter sederhana dari opsi yang ada
                let optionsString = '';
                if (command.data.options && command.data.options.length > 0) {
                    optionsString = command.data.options.map(opt => `\`<${opt.name}>\``).join(' ');
                }

                helpEmbed.addFields({
                    name: `</${command.data.name}:${interaction.commandId}> ${optionsString}`,
                    value: command.data.description
                });
            });
            
            await interaction.reply({ embeds: [helpEmbed], ephemeral: true });

        } catch (error) {
            console.error("Error pada perintah /bantuan:", error);
            await interaction.reply({ content: 'Maaf, terjadi kesalahan saat menampilkan bantuan.', ephemeral: true });
        }
    },
};