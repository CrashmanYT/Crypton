// commands/waspada.js (Versi dengan Perbaikan Error Handling)

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
        await interaction.deferReply({ ephemeral: true });
        const tokenAddress = interaction.options.getString('alamat');
        const chainIdMap = { 'solana_mainnet': 'solana', 'eth_mainnet': '1', 'base_mainnet': '8453' };
        const chainId = chainIdMap[interaction.options.getString('jaringan')];

        try {
            const response = await GoPlus.tokenSecurity(chainId, [tokenAddress], 30);

            if (response.code !== ErrorCode.SUCCESS) {
                return await interaction.editReply({ content: `❌ Terjadi kesalahan saat memanggil API Keamanan: ${response.message}` });
            }

            // ### PERBAIKAN UTAMA DI SINI ###
            // Cek jika objek result itu sendiri null atau tidak ada.
            if (!response.result) {
                return await interaction.editReply({ content: `❌ Data keamanan untuk token \`${tokenAddress}\` tidak ditemukan di GoPlus.` });
            }

            const data = response.result[tokenAddress.toLowerCase()];

            // Cek sekali lagi jika data spesifik untuk token tersebut tidak ada di dalam result.
            if (!data) {
                return await interaction.editReply({ content: `❌ Data keamanan untuk token \`${tokenAddress}\` tidak ditemukan di GoPlus.` });
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
                .setFooter({ text: 'Analisis oleh GoPlus Security | Bot Crypton' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Error pada /waspada:", error);
            await interaction.editReply({ content: "Terjadi kesalahan internal saat memproses permintaan keamanan." });
        }
    },
};
