// events/ready.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🔥 Bot ${client.user.tag} v5.0 (Refactored) sudah online!`);
        client.user.setActivity('Menganalisa Multi-Chain');
    },
};