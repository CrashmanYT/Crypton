// commands/analisa.js (Versi Refactored yang Disederhanakan)

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../services/apiClient.js'); // Menggunakan modul apiClient
const taCalculator = require('../services/taCalculator.js'); // Menggunakan modul taCalculator
const { GoPlus, ErrorCode } = require('@goplus/sdk-node');

module.exports = {
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
                    { name: '5 Menit', value: '5m' },
                    { name: '15 Menit', value: '15m' },
                    { name: '30 Menit', value: '30m' },
                    { name: '1 Jam', value: '1H' },
                    { name: '4 Jam', value: '4H' },
                    { name: '1 Hari', value: '1D' }
                )),
                
    async execute(interaction) {
        await interaction.deferReply();
        const tokenAddress = interaction.options.getString('alamat');
        const timeframe = interaction.options.getString('timeframe') || '1H';

        let securityData = null;
        let taData = null;
        let errorMessages = [];

        // LANGKAH 1: AMBIL DATA DASAR DARI DEXSCREENER
        const dexScreenerResult = await apiClient.getDexScreenerData(tokenAddress);
        if (!dexScreenerResult.success) {
            await interaction.editReply(`❌ ${dexScreenerResult.error} Alamat: \`${tokenAddress}\``);
            return;
        }
        const dexData = dexScreenerResult.data;

        const baseInfo = {
            name: dexData.baseToken.name, symbol: dexData.baseToken.symbol, priceUsd: dexData.priceUsd,
            marketCap: dexData.marketCap, chain: dexData.chainId, url: dexData.url,
            liquidity: dexData.liquidity.usd, volume: dexData.volume.h24
        };

        // LANGKAH 2: AMBIL DATA KEAMANAN DARI GOPLUS
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

        // LANGKAH 3: AMBIL DATA HISTORIS & HITUNG TA
        const birdeyeResult = await apiClient.getBirdeyeHistoricalData(tokenAddress, baseInfo.chain, timeframe);
        if (birdeyeResult.success && birdeyeResult.data.success) {
            const closingPrices = birdeyeResult.data.data.items.map(item => item.value);
            taData = taCalculator.calculateAll(closingPrices);
             if (!taData) {
                errorMessages.push('⚠️ Data historis tidak cukup untuk Analisa Teknikal.');
            }
        } else {
            errorMessages.push(birdeyeResult.error || '⚠️ Gagal mengambil data Analisa Teknikal.');
        }

        // LANGKAH 4: BANGUN ANALISIS (PROS & CONS)
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
        if (taData) {
            if(taData.rsi > 70) cons.push(`RSI Overbought (${taData.rsi})`);
            if(taData.rsi < 30) pros.push(`RSI Oversold (${taData.rsi})`);
            if(baseInfo.priceUsd > taData.sma20) pros.push(`Harga di atas SMA 20 (Uptrend)`);
            else cons.push(`Harga di bawah SMA 20 (Downtrend)`);
            if (taData.macd.MACD > taData.macd.signal) pros.push(`MACD Bullish Cross`);
            else cons.push(`MACD Bearish Cross`);
            if (baseInfo.priceUsd < taData.bollingerBands.lower) pros.push(`Harga di Lower Bollinger Band`);
        }

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
        if (taData) {
            if (taData.rsi) taDescription.push(`**RSI (14):** ${taData.rsi}`);
            if (taData.macd) taDescription.push(`**MACD:** ${taData.macd.MACD > taData.macd.signal ? 'Bullish' : 'Bearish'}`);
            if (taData.bollingerBands) {
                const position = baseInfo.priceUsd > taData.bollingerBands.upper ? 'di atas' : (baseInfo.priceUsd < taData.bollingerBands.lower ? 'di bawah' : 'di dalam');
                taDescription.push(`**BBands:** Harga ${position} band.`);
            }
        }
        if (taDescription.length > 0) {
            embed.addFields({ name: `📊 Technical Analysis (Timeframe: ${timeframe})`, value: taDescription.join('\n')});
        }

        if (errorMessages.length > 0) {
            embed.addFields({ name: '⚠️ Peringatan', value: errorMessages.join('\n') });
        }
        
        embed.addFields({ name: 'VERDICT', value: recommendation });
        embed.setFooter({ text: 'Data by Dexscreener, GoPlus, Birdeye | Bot Crypton' }).setTimestamp();
        
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
