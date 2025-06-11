// commands/analisa.js (v7.0 - Advanced Technical Analysis)

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { GoPlus, ErrorCode } = require('@goplus/sdk-node');
// const birdeyedotso = require('@api/birdeyedotso'); // Tidak lagi digunakan, kita kembali ke axios
const { RSI, SMA, MACD, BollingerBands } = require('technicalindicators');

module.exports = {
    // 1. DEFINISI PERINTAH DENGAN OPSI TIMEFRAME BARU
    data: new SlashCommandBuilder()
        .setName('analisa')
        .setDescription('Menganalisa token dengan Analisa Teknikal (TA) yang lebih dalam.')
        .addStringOption(option =>
            option.setName('alamat')
                .setDescription('Alamat kontrak token yang ingin dianalisa')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('timeframe')
                .setDescription('Pilih timeframe untuk Analisa Teknikal. Default: 1 Jam.')
                .setRequired(false)
                .addChoices(
                    { name: '1 Jam', value: '1H' },
                    { name: '4 Jam', value: '4H' },
                    { name: '1 Hari', value: '1D' }
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const tokenAddress = interaction.options.getString('alamat');
        // Ambil nilai timeframe dari opsi, jika tidak ada, default ke '1H'
        const timeframe = interaction.options.getString('timeframe') || '1H';

        let baseInfo = null;
        let securityData = null;
        let taData = {};
        let errorMessages = [];
        let dexscreenerFailed = false;

        // LANGKAH 1: Ambil data dari Dexscreener
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
            dexscreenerFailed = true;
        }

        if (!baseInfo) {
            const replyMessage = dexscreenerFailed ? '❌ Gagal terhubung ke API Dexscreener.' : `❌ Token \`${tokenAddress}\` tidak dapat ditemukan.`;
            await interaction.editReply({ content: replyMessage, ephemeral: true });
            return;
        }

        // LANGKAH 2: Ambil data dari GoPlus
        const chainMapSdk = { 'solana': 'solana', 'ethereum': '1', 'base': '8453' };
        const chainIdForSdk = chainMapSdk[baseInfo.chain];
        if (chainIdForSdk) {
            try {
                const goplusRes = await GoPlus.tokenSecurity(chainIdForSdk, [tokenAddress], 30);
                if (goplusRes.code === ErrorCode.SUCCESS && goplusRes.result) {
                    securityData = goplusRes.result[tokenAddress.toLowerCase()];
                }
            } catch (secError) {
                errorMessages.push('⚠️ Gagal terhubung ke API Keamanan.');
            }
        }

        // LANGKAH 3: AMBIL DATA HISTORIS & HITUNG TA (MENGGUNAKAN AXIOS)
        const chainForBirdeye = baseInfo.chain;
        if (chainForBirdeye) {
            try {
                // Tentukan rentang waktu data yang diambil berdasarkan timeframe
                const now = new Date();
                let timeFrom;
                switch (timeframe) {
                    case '4H':
                        timeFrom = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Ambil data 7 hari
                        break;
                    case '1D':
                        timeFrom = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)); // Ambil data 60 hari
                        break;
                    case '1H':
                    default:
                        timeFrom = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)); // Ambil data 3 hari
                        break;
                }
                const time_from_unix = Math.floor(timeFrom.getTime() / 1000);
                const time_to_unix = Math.floor(now.getTime() / 1000);

                const birdeyeRes = await axios.get(`https://public-api.birdeye.so/defi/history_price`, {
                    params: {
                        address: tokenAddress,
                        address_type: 'token',
                        type: timeframe,
                        time_from: time_from_unix,
                        time_to: time_to_unix
                    },
                    headers: {
                        'X-API-KEY': process.env.BIRDEYE_API_KEY,
                        'x-chain': chainForBirdeye // Header untuk multi-chain
                    }
                });
                
                if (birdeyeRes.data.success && birdeyeRes.data.data.items.length > 25) { // Butuh lebih banyak data untuk MACD/BBands
                    const closingPrices = birdeyeRes.data.data.items.map(item => item.value);

                    taData.rsi = RSI.calculate({ values: closingPrices, period: 14 }).pop()?.toFixed(2);
                    taData.sma20 = SMA.calculate({ values: closingPrices, period: 20 }).pop();
                    taData.macd = MACD.calculate({ values: closingPrices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, TEMA: false }).pop();
                    taData.bollingerBands = BollingerBands.calculate({ values: closingPrices, period: 20, stdDev: 2 }).pop();
                } else {
                     errorMessages.push('⚠️ Data historis tidak cukup untuk TA pada timeframe ini.');
                }
            } catch(taError) { 
                console.error(`Gagal mengambil data historis dari Birdeye. Detail:`, taError.response?.data || taError.message);
                errorMessages.push('⚠️ Gagal mengambil data Analisa Teknikal.');
            }
        }

        // LANGKAH 4: BANGUN ANALISIS (DENGAN LOGIKA TA BARU)
        let pros = [];
        let cons = [];
        
        if (baseInfo.liquidity > 50000) pros.push(`Likuiditas Sehat`); else cons.push(`Likuiditas Rendah`);
        if (baseInfo.volume > 100000) pros.push(`Volume 24j Tinggi`); else cons.push('Volume Rendah');
        if (securityData) {
            if (securityData.is_honeypot === '1') cons.push('TERDETEKSI HONEYPOT!');
            if (securityData.is_mintable === '1') cons.push('Fungsi Mint Aktif');
            if (securityData.top_10_holder_rate > 0.4) cons.push(`Holder Terkonsentrasi`);
            if (securityData.is_honeypot === '0' && securityData.is_mintable === '0') pros.push('Kontrak Aman');
        } else {
            cons.push('Keamanan tdk dpt diverifikasi');
        }

        if(taData.rsi) {
            if(taData.rsi > 70) cons.push(`RSI Overbought (${taData.rsi})`);
            if(taData.rsi < 30) pros.push(`RSI Oversold (${taData.rsi})`);
        }
        if(taData.sma20) {
            if(baseInfo.priceUsd > taData.sma20) pros.push(`Harga di atas SMA 20 (Uptrend)`);
            else cons.push(`Harga di bawah SMA 20 (Downtrend)`);
        }
        if (taData.macd && taData.macd.MACD > taData.macd.signal) pros.push(`MACD Bullish Cross`);
        else if (taData.macd) cons.push(`MACD Bearish Cross`);
        
        if (taData.bollingerBands && baseInfo.priceUsd < taData.bollingerBands.lower) pros.push(`Harga di Lower Bollinger Band`);

        // LANGKAH 5: TAMPILKAN EMBED
        let recommendation = '🤔 **CAUTION.** Sinyal negatif lebih dominan.';
        let embedColor = '#F1C40F';
        if (cons.includes('TERDETEKSI HONEYPOT!')) {
            recommendation = '🚨 **AVOID!** Token ini adalah honeypot.';
            embedColor = '#E74C3C';
        } else if (cons.length >= 3 && cons.length > pros.length) {
            recommendation = '🚨 **HIGH RISK.** Cenderung Bearish.';
            embedColor = '#E67E22';
        } else if (pros.length > cons.length) {
            recommendation = '✅ **LOOKS PROMISING.** Cenderung Bullish.';
            embedColor = '#2ECC71';
        }
        
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`📈 Analisa Lengkap: ${baseInfo.name} (${baseInfo.symbol})`)
            .setURL(baseInfo.url)
            .setDescription(`**Harga:** $${Number(baseInfo.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n**Market Cap:** $${Number(baseInfo.marketCap).toLocaleString('en-US')}`)
            .addFields(
                { name: '✅ PROS / Bullish Signs', value: pros.length > 0 ? '✅ ' + pros.join('\n✅ ') : 'None', inline: true },
                { name: '🚩 CONS / Bearish Signs', value: cons.length > 0 ? '🚩 ' + cons.join('\n🚩 ') : 'None', inline: true },
                { name: '\u200B', value: '\u200B' }
            );

        const taDescription = [];
        if (taData.rsi) taDescription.push(`**RSI (14):** ${taData.rsi}`);
        if (taData.macd) taDescription.push(`**MACD:** ${taData.macd.MACD > taData.macd.signal ? 'Bullish' : 'Bearish'}`);
        if (taData.bollingerBands) {
            const position = baseInfo.priceUsd > taData.bollingerBands.upper ? 'di atas' : (baseInfo.priceUsd < taData.bollingerBands.lower ? 'di bawah' : 'di dalam');
            taDescription.push(`**BBands:** Harga ${position} band.`);
        }
        if (taDescription.length > 0) {
            embed.addFields({ name: `📊 Technical Analysis (Timeframe: ${timeframe})`, value: taDescription.join('\n')});
        }

        if (errorMessages.length > 0) {
            embed.addFields({ name: '⚠️ Peringatan', value: errorMessages.join('\n') });
        }
        
        embed.addFields({ name: 'VERDICT', value: recommendation });
        embed.setFooter({ text: 'Data by Dexscreener, GoPlus, Birdeye | Bot Naga Koin 🐉' }).setTimestamp();
        
        const explorerMap = {
            'solana': 'https://solscan.io/token/',
            'ethereum': 'https://etherscan.io/token/',
            'base': 'https://basescan.org/token/'
        };
        const row = new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setLabel('DexScreener').setURL(baseInfo.url).setStyle(ButtonStyle.Link).setEmoji('🔎'))
            .addComponents(new ButtonBuilder().setLabel('Birdeye').setURL(`https://birdeye.so/token/${tokenAddress}?chain=${baseInfo.chain}`).setStyle(ButtonStyle.Link).setEmoji('🦅'));
        const explorerUrl = explorerMap[baseInfo.chain];
        if (explorerUrl) {
            row.addComponents(new ButtonBuilder().setLabel('Explorer').setURL(explorerUrl + tokenAddress).setStyle(ButtonStyle.Link).setEmoji('🔗'));
        }

        await interaction.editReply({ 
            embeds: [embed],
            components: [row]
        });
    },
};
