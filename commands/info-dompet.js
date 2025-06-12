// commands/info-dompet.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const apiClient = require('../services/apiClient.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info-dompet')
        .setDescription('Menganalisis isi dan PnL sebuah dompet menggunakan Moralis.')
        .addStringOption(option =>
            option.setName('alamat_dompet')
                .setDescription('Alamat dompet yang ingin dianalisis.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('jaringan')
                .setDescription('Pilih jaringan dompet. Default: Solana.')
                .setRequired(false)
                .addChoices(
                    { name: 'Solana', value: 'solana' },
                    { name: 'Ethereum', value: 'eth' },
                    { name: 'Base', value: 'base' }
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const walletAddress = interaction.options.getString('alamat_dompet');
        const network = interaction.options.getString('jaringan') || 'solana';

        // 1. Panggil API Moralis untuk mendapatkan data portfolio
        const portfolioResult = await apiClient.getWalletPortfolio(walletAddress, network);

        if (!portfolioResult.success) {
            return await interaction.editReply(`❌ Gagal menganalisis dompet: ${portfolioResult.error}`);
        }
        
        const portfolio = portfolioResult.data;
        
        // 2. Urutkan token berdasarkan nilai USD
        const topTokens = portfolio.tokens.sort((a, b) => b.usd_value - a.usd_value).slice(0, 10); // Ambil 10 teratas

        // 3. Bangun embed
        const embed = new EmbedBuilder()
            .setColor('#8A2BE2')
            .setTitle(`🔍 Analisis Dompet: ...${walletAddress.slice(-6)}`)
            .setURL(`https://solscan.io/account/${walletAddress}`) // Asumsi Solana, bisa dibuat dinamis
            .addFields(
                { name: 'Total Nilai Aset', value: `$${Number(portfolio.usd_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, inline: true },
                { name: 'Jaringan', value: network.charAt(0).toUpperCase() + network.slice(1), inline: true }
            );

        if (topTokens.length > 0) {
            let tokenDescription = '';
            for (const token of topTokens) {
                const pnl = token.pnl?.usd_change ?? 0;
                const pnlSign = pnl >= 0 ? '+' : '';
                const pnlPercent = token.pnl?.percentage_change ? `(${pnlSign}${(token.pnl.percentage_change * 100).toFixed(1)}%)` : '';
                
                tokenDescription += `**${token.name} (${token.symbol})**\n` +
                                    `> Nilai: **$${Number(token.usd_value).toFixed(2)}**\n` +
                                    `> PnL: ${pnlSign}$${Number(pnl).toFixed(2)} ${pnlPercent}\n`;
            }
            embed.addFields({ name: `💰 Top 10 Aset Teratas`, value: tokenDescription });
        } else {
             embed.addFields({ name: 'Aset', value: 'Tidak ada token yang terdeteksi di dompet ini.' });
        }
        
        embed.setFooter({ text: 'Data oleh Moralis' }).setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },
};
