const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GoPlus, ErrorCode } = require('@goplus/sdk-node');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('waspada')
        .setDescription('Melakukan audit keamanan cepat pada sebuah token.')
        .addStringOption(option => option.setName('alamat').setDescription('Alamat kontrak token').setRequired(true))
        .addStringOption(option => option.setName('jaringan').setDescription('Pilih jaringan dari token tersebut').setRequired(true)
            .addChoices(
                { name: 'Solana', value: 'solana_mainnet' },
                { name: 'Ethereum', value: 'eth_mainnet' },
                { name: 'Base', value: 'base_mainnet' }
            )),
    async execute(interaction) {
        await interaction.deferReply();
        const tokenAddress = interaction.options.getString('alamat');
        const chainIdMap = { 'solana_mainnet': 'solana', 'eth_mainnet': '1', 'base_mainnet': '8453' };
        const chainId = chainIdMap[interaction.options.getString('jaringan')];

        try {
            const response = await GoPlus.tokenSecurity(chainId, [tokenAddress], 30);

            if (response.code !== ErrorCode.SUCCESS) {
                await interaction.editReply(`❌ Terjadi kesalahan: ${response.message}`);
                return;
            }

            const data = response.result[tokenAddress.toLowerCase()];

            if (!data) {
                await interaction.editReply('❌ Tidak dapat menemukan data keamanan untuk token ini.');
                return;
            }

            let description = '';
            if (data.is_honeypot === '1') description += '🚨 **Honeypot:** **YA** (Tidak bisa dijual!)\n';
            else description += '✅ **Honeypot:** **TIDAK**\n';

            if (data.is_mintable === '1') description += '⚠️ **Bisa di-Mint:** **YA** (Supply bisa ditambah)\n';
            else description += '✅ **Bisa di-Mint:** **TIDAK**\n';

            const topHoldersPercent = (Number(data.top_10_holder_rate) * 100).toFixed(2);
            description += `📊 **Top 10 Holder:** ${topHoldersPercent}%\n`;

            const ownerPercent = (Number(data.owner_percent) * 100).toFixed(2);
            description += `💼 **Kepemilikan Owner:** ${ownerPercent}%\n`;

            const embed = new EmbedBuilder()
                .setTitle(`🛡️ Laporan Keamanan: ${data.token_name} (${data.token_symbol})`)
                .setDescription(description)
                .setColor(data.is_honeypot === '1' ? '#E74C3C' : '#2ECC71')
                .setFooter({ text: 'Analisis oleh GoPlus Security | Bot Naga Koin 🐉' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error pada /waspada:", error);
            await interaction.editReply("Terjadi kesalahan saat memproses permintaan keamanan.");
        }
    },
};