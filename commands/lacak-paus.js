// commands/lacak-paus.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const apiClient = require('../services/apiClient.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lacak-paus')
        .setDescription('Menemukan pembeli terbesar (paus) untuk sebuah token baru-baru ini.')
        .addStringOption(option =>
            option.setName('alamat_token')
                .setDescription('Alamat kontrak token yang ingin dilacak.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const tokenAddress = interaction.options.getString('alamat_token');

        // Langkah 1: Dapatkan data token dasar untuk menemukan alamat 'pair'
        const pairDataResult = await apiClient.getDexScreenerData(tokenAddress);
        if (!pairDataResult.success) {
            return await interaction.editReply(`❌ Gagal melacak token: ${pairDataResult.error}`);
        }
        
        const pairInfo = pairDataResult.data;
        const pairAddress = pairInfo.pairAddress;
        const tokenSymbol = pairInfo.baseToken.symbol;
        // PERBAIKAN: Ambil chainId dari data token
        const chainId = pairInfo.chainId;

        // Langkah 2: Dapatkan daftar transaksi dengan menyertakan chainId
        const tradesResult = await apiClient.getRecentTrades(chainId, pairAddress);
        if (!tradesResult.success) {
            return await interaction.editReply(`❌ Gagal mengambil riwayat transaksi: ${tradesResult.error}`);
        }

        // Langkah 3: Analisis transaksi untuk menemukan pembeli terbesar
        const buyers = {};
        for (const trade of tradesResult.data) {
            if (trade.type === 'buy') {
                const buyerAddress = trade.maker.address;
                const buyAmountUsd = trade.amountUsd;

                if (!buyers[buyerAddress]) {
                    buyers[buyerAddress] = { totalBuy: 0, txCount: 0 };
                }
                buyers[buyerAddress].totalBuy += buyAmountUsd;
                buyers[buyerAddress].txCount += 1;
            }
        }

        // Langkah 4: Urutkan pembeli berdasarkan total pembelian
        const sortedBuyers = Object.entries(buyers)
            .sort(([, a], [, b]) => b.totalBuy - a.totalBuy)
            .slice(0, 5);

        // Langkah 5: Bangun 'Embed' untuk ditampilkan di Discord
        const embed = new EmbedBuilder()
            .setColor('#1E90FF')
            .setTitle(`🐋 Lacak Paus untuk Token: $${tokenSymbol}`)
            .setURL(pairInfo.url)
            .setDescription(`Menampilkan 5 dompet dengan total pembelian terbesar dari **${tradesResult.data.length}** transaksi terakhir.`);

        if (sortedBuyers.length > 0) {
            for (const [address, data] of sortedBuyers) {
                // Buat link explorer yang dinamis berdasarkan chainId
                const explorerUrl = chainId === 'solana' ? `https://solscan.io/account/${address}` : `https://dexscreener.com/${chainId}/address/${address}`;
                const explorerName = chainId === 'solana' ? 'Solscan' : 'Explorer';

                embed.addFields({
                    name: `Paus: ...${address.slice(-6)}`,
                    value: `💰 **Total Beli:** $${data.totalBuy.toLocaleString('en-US', {minimumFractionDigits: 2})}\n` +
                           `🔄 **Jumlah Transaksi:** ${data.txCount}\n` +
                           `[Lihat di ${explorerName}](${explorerUrl})`
                });
            }
        } else {
            embed.addFields({ name: 'Tidak Ditemukan', value: 'Tidak ada transaksi pembelian yang terdeteksi dalam data terbaru.' });
        }

        embed.setFooter({ text: 'Data oleh DexScreener | Lakukan Riset Anda Sendiri (DYOR)' }).setTimestamp();

        // Kirim balasan ke pengguna
        await interaction.editReply({ embeds: [embed] });
    },
};
