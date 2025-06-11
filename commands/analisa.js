const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { GoPlus, ErrorCode } = require('@goplus/sdk-node');
const { RSI, SMA } = require('technicalindicators');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analisa')
        .setDescription('Menganalisa token memecoin dari alamat kontrak.')
        .addStringOption(option => option.setName('alamat').setDescription('Alamat kontrak token').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
      const tokenAddress = interaction.options.getString('alamat');

        let baseInfo = null;
        let securityData = null;
        let taData = {};
        let errorMessages = [];
        let dexscreenerFailed = false;

        // LANGKAH 1: AMBIL DATA REAL-TIME DARI DEXSCREENER
        try {
            const dexscreenerRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
            const dexData = dexscreenerRes.data.pairs ? dexscreenerRes.data.pairs[0] : null;
            if (dexData) {
                baseInfo = {
                    name: dexData.baseToken.name, symbol: dexData.baseToken.symbol, priceUsd: dexData.priceUsd,
                    marketCap: dexData.marketCap, chain: dexData.chainId, url: dexData.url,
                    liquidity: dexData.liquidity.usd, volume: dexData.volume.h24
                };
            }
        } catch (error) {
            console.log("Gagal mengambil data dari Dexscreener.");
        }
        // Penanganan Error Kritis: Jika data Dexscreener tidak ada, hentikan proses.
        if (!baseInfo) {
            const replyMessage = dexscreenerFailed
                ? '❌ Gagal terhubung ke API Dexscreener. Coba lagi sesaat lagi.'
                : `❌ Token dengan alamat \`${tokenAddress}\` tidak dapat ditemukan di Dexscreener.`;
            await interaction.editReply({ content: replyMessage, ephemeral: true });
            return;
        }

        // LANGKAH 2: AMBIL DATA KEAMANAN DARI GOPLUS
        const chainMapSdk = { 'solana': 'solana', 'ethereum': '1', 'base': '8453' };
        const chainIdForSdk = chainMapSdk[baseInfo.chain];
        if (chainIdForSdk) {
            try {
                const goplusRes = await GoPlus.tokenSecurity(chainIdForSdk, [tokenAddress], 30);
                if (goplusRes.code === ErrorCode.SUCCESS && goplusRes.result) {
                    securityData = goplusRes.result[tokenAddress.toLowerCase()];
                } else {
                    errorMessages.push('⚠️ Data keamanan tidak ditemukan di GoPlus.');   
                }
            } catch (secError) { 
                console.log("Gagal mengambil data GoPlus.");
                errorMessages.push('⚠️ Gagal terhubung ke API Keamanan (GoPlus).');

             }
        }

        // LANGKAH 3: AMBIL DATA HISTORIS & HITUNG TA DARI BIRDEYE (LOGIKA MULTI-CHAIN)
        const chainForBirdeye = baseInfo.chain; // Birdeye biasanya menerima nama chain seperti 'solana', 'ethereum'

        if (chainForBirdeye) {
            try {
                const now = Math.floor(Date.now() / 1000);
                const yesterday = now - (24 * 60 * 60);
               const birdeyeRes = await axios.get(`https://public-api.birdeye.so/defi/history_price`, {
                    params: {
                        address: tokenAddress,
                        address_type: 'token',
                        type: '1H',
                        time_from: yesterday,
                        time_to: now
                    },
                    headers: {
                        'X-API-KEY': process.env.BIRDEYE_API_KEY
                    }
                });

                if (birdeyeRes.data.success && birdeyeRes.data.data.items.length > 14) {
                    const closingPrices = birdeyeRes.data.data.items.map(item => item.value);
                    const rsiResult = RSI.calculate({ values: closingPrices, period: 14 });
                    taData.rsi = rsiResult[rsiResult.length - 1].toFixed(2);
                    if (closingPrices.length >= 20) {
                        const sma20Result = SMA.calculate({ values: closingPrices, period: 20 });
                        taData.sma20 = sma20Result[sma20Result.length - 1];
                    } else { taData.sma20 = 'N/A'; }
                } else {
                    errorMessages.push('⚠️ Data historis tidak cukup untuk Analisa Teknikal.');

                }
            } catch(taError) { 
                console.error(`Gagal mengambil data historis dari Birdeye untuk jaringan ${chainForBirdeye}. Detail:`, taError);
                errorMessages.push('⚠️ Gagal mengambil data Analisa Teknikal (Birdeye).');

            }
        } else {
            console.log(`Analisa Teknikal tidak dijalankan karena jaringan "${baseInfo.chain}" tidak didukung.`);
        }

        // LANGKAH 4: BANGUN ANALISIS & REKOMENDASI
        let pros = [];
        let cons = [];

        if (baseInfo.liquidity > 50000) pros.push(`Likuiditas Sehat ($${Number(baseInfo.liquidity).toLocaleString('en-US')})`); else cons.push(`Likuiditas Rendah ($${Number(baseInfo.liquidity).toLocaleString('en-US')})`);
        if (baseInfo.volume > 100000) pros.push(`Volume 24j Tinggi ($${Number(baseInfo.volume).toLocaleString('en-US')})`); else cons.push('Volume Rendah');
        if (securityData) {
            if (securityData.is_honeypot === '1') cons.push('TERDETEKSI HONEYPOT!');
            if (securityData.is_mintable === '1') cons.push('Fungsi Mint Aktif');
            const topHoldersPercent = (securityData.top_10_holder_rate * 100).toFixed(1);
            if (topHoldersPercent > 40) cons.push(`Holder Terkonsentrasi (${topHoldersPercent}%)`);
            if (securityData.is_honeypot === '0' && securityData.is_mintable === '0') pros.push('Kontrak Aman');
        } else {
            cons.push('Keamanan tdk dpt diverifikasi');
        }
        if(taData.rsi) {
            if(taData.rsi > 70) cons.push(`RSI Overbought (${taData.rsi})`);
            if(taData.rsi < 30) pros.push(`RSI Oversold (${taData.rsi})`);
        }
        if(taData.sma20 && taData.sma20 !== 'N/A') {
            if(baseInfo.priceUsd > taData.sma20) pros.push(`Harga di atas SMA 20 (Uptrend)`);
            else cons.push(`Harga di bawah SMA 20 (Downtrend)`);
        }
        
        let recommendation = '🤔 **CAUTION.** Sinyal negatif lebih dominan. Tunggu konfirmasi lebih lanjut.';
        let embedColor = '#F1C40F';
        if (cons.includes('TERDETEKSI HONEYPOT!')) {
            recommendation = '🚨 **AVOID!** Token ini adalah honeypot.';
            embedColor = '#E74C3C';
        } else if (cons.length > pros.length && cons.length >= 3) {
            recommendation = '🚨 **HIGH RISK.** Cenderung Bearish. Terlalu banyak sinyal negatif.';
            embedColor = '#E67E22';
        } else if (pros.length > cons.length) {
            recommendation = '✅ **LOOKS PROMISING.** Cenderung Bullish. Sinyal positif lebih dominan, namun tetap DYOR.';
            embedColor = '#2ECC71';
        }

        // LANGKAH 5: TAMPILKAN EMBED LENGKAP
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`📈 Analisa Lengkap: ${baseInfo.name} (${baseInfo.symbol})`)
            .setURL(baseInfo.url)
            .setDescription(`**Harga:** $${Number(baseInfo.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n**Market Cap:** $${Number(baseInfo.marketCap).toLocaleString('en-US')}`)
            .addFields(
                // PERUBAHAN DI SINI: Menambahkan Emoji
                { name: 'PROS / Bullish Signs', value: pros.length > 0 ? '✅ ' + pros.join('\n✅ ') : 'None', inline: true },
                { name: 'CONS / Bearish Signs', value: cons.length > 0 ? '🚩 ' + cons.join('\n🚩 ') : 'None', inline: true },
                { name: '\u200B', value: '\u200B' },
                { name: `📊 Technical Analysis (${baseInfo.chain})`, value: `**RSI (14 jam):** ${taData.rsi || 'N/A'}\n**SMA (20 jam):** ${taData.sma20 ? Number(taData.sma20).toFixed(6) : 'N/A'}` },
                { name: 'VERDICT', value: recommendation }
            )
            .setFooter({ text: 'Data by Dexscreener, GoPlus, Birdeye | Bot Naga Koin 🐉' })
            .setTimestamp();
        const explorerMap = {
            'solana': 'https://solscan.io/token/',
            'ethereum': 'https://etherscan.io/token/',
            'base': 'https://basescan.org/token/'
        };

        const row = new ActionRowBuilder();

        // 1. Tombol DexScreener (selalu ada jika baseInfo ditemukan)
        row.addComponents(
            new ButtonBuilder()
                .setLabel('DexScreener')
                .setURL(baseInfo.url)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔎')
        );

        // 2. Tombol Birdeye
        row.addComponents(
            new ButtonBuilder()
                .setLabel('Birdeye')
                .setURL(`https://birdeye.so/token/${tokenAddress}?chain=${baseInfo.chain}`)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🦅')
        );

        // 3. Tombol Explorer (Solscan/Etherscan/dll)
        const explorerUrl = explorerMap[baseInfo.chain];
        if (explorerUrl) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('Blockchain Explorer')
                    .setURL(explorerUrl + tokenAddress)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔗')
            );
        }
        await interaction.editReply({ embeds: [embed], components:[row] });
    },
};