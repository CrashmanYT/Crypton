// commands/sentimen.js (v2.0 - Advanced Social Sentiment Analysis)

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const apiClient = require('../services/apiClient.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('sentimen')
        .setDescription('Menganalisis sentimen sosial dari Stocktwits & Reddit.')
        .addStringOption(option =>
            option.setName('simbol')
                .setDescription('Simbol atau Ticker token (misal: SOL, WIF, ETH)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const symbol = interaction.options.getString('simbol').toUpperCase();

        try {
            const tokenName = await apiClient.getTokenName(symbol);

            // LANGKAH 2: Panggil API secara paralel
            const redditQuery = encodeURIComponent(`"${symbol}" OR "$${symbol}" OR "${tokenName}"`);
            const [stocktwitsResult, redditResult] = await Promise.all([
                apiClient.getStocktwitsData(`${symbol}.X`),
                apiClient.getRedditData(redditQuery)
            ]);
            
            // LANGKAH 3: Proses Hasil dari Setiap API
            let stocktwitsData = { bullish: 0, bearish: 0, totalMessages: 0, influenceScore: 0, url: null };
            if (stocktwitsResult.success && stocktwitsResult.data.messages) {
                const messages = stocktwitsResult.data.messages;
                stocktwitsData.totalMessages = messages.length;
                stocktwitsData.url = stocktwitsResult.data.symbol?.stocktwits_symbol_url || null;
                for (const msg of messages) {
                    if (msg.entities.sentiment?.basic === 'Bullish') stocktwitsData.bullish++;
                    if (msg.entities.sentiment?.basic === 'Bearish') stocktwitsData.bearish++;
                    stocktwitsData.influenceScore += msg.user.followers;
                }
            }

            let redditData = { mentions: 0, activeUsers: 0 };
            if (redditResult.success && redditResult.data.data.children) {
                const postsAndComments = redditResult.data.data.children;
                redditData.mentions = postsAndComments.length;
                const authors = new Set(postsAndComments.map(p => p.data.author));
                redditData.activeUsers = authors.size;
            }

            // Jika kedua API gagal
            if (!stocktwitsResult.success && !redditResult.success) {
                return await interaction.editReply(`❌ Gagal mengambil data dari Stocktwits dan Reddit untuk **${symbol}**.`);
            }

            // LANGKAH 4: Kalkulasi Hype Meter Akhir
            const totalSentiments = stocktwitsData.bullish + stocktwitsData.bearish;
            const sentimentScore = totalSentiments > 0 ? ((stocktwitsData.bullish / totalSentiments) * 100) : 50;
            
            let hypeMeter = 'Netral 😐';
            if (sentimentScore > 65 && redditData.mentions > 10) {
                hypeMeter = 'Sangat Bullish 🔥';
            } else if (sentimentScore > 60 || redditData.mentions > 20) {
                hypeMeter = 'Bullish ✅';
            } else if (sentimentScore < 40 || (stocktwitsData.totalMessages > 10 && redditData.mentions < 5)) {
                hypeMeter = 'Bearish 📉';
            } else if (stocktwitsData.totalMessages === 0 && redditData.mentions === 0) {
                hypeMeter = 'Tidak Ada Aktivitas 💤';
            }
            
            // LANGKAH 5: Tampilkan Embed yang Sudah Ditingkatkan
            const embed = new EmbedBuilder()
                .setColor(sentimentScore > 60 ? '#2ECC71' : (sentimentScore < 40 ? '#E74C3C' : '#F1C40F'))
                .setTitle(`📱 Analisis Sentimen Sosial untuk: $${symbol}`)
                .setDescription(`*Menyintesis data dari Stocktwits dan Reddit.*`)
                .addFields(
                    { name: 'Sentimen Stocktwits', value: `**${stocktwitsData.bullish}** Bullish vs **${stocktwitsData.bearish}** Bearish\n**Skor:** ${sentimentScore.toFixed(0)}% Bullish`, inline: true },
                    { name: 'Pengaruh Stocktwits', value: `**${stocktwitsData.influenceScore.toLocaleString('en-US')}** total pengikut`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true }, // Spasi
                    { name: 'Aktivitas Reddit', value: `**${redditData.mentions}** mention terbaru`, inline: true },
                    { name: 'Komunitas Reddit', value: `**${redditData.activeUsers}** pengguna aktif`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: 'Verdict / Hype Meter', value: `**${hypeMeter}**` }
                )
                .setFooter({ text: 'Data dari Stocktwits & Reddit API' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error pada perintah /sentimen:', error);
            await interaction.editReply('❌ Terjadi kesalahan internal saat memproses analisis sentimen.');
        }
    },
};
