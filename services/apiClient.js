// services/apiClient.js
// Modul ini bertanggung jawab untuk semua interaksi dengan API eksternal.

const axios = require('axios');

const apiClient = {
    /**
     * Mengambil data token dasar dari Dexscreener.
     * @param {string} tokenAddress Alamat kontrak token.
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getDexScreenerData: async (tokenAddress) => {
        try {
            const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
            const pair = response.data.pairs ? response.data.pairs[0] : null;
            if (!pair) {
                return { success: false, error: 'Token tidak ditemukan di DexScreener.' };
            }
            return { success: true, data: pair };
        } catch (error) {
            console.error(`[API Client] Gagal mengambil data Dexscreener untuk ${tokenAddress}:`, error.message);
            return { success: false, error: 'Gagal terhubung ke API DexScreener.' };
        }
    },

    /**
     * Mengambil data harga historis dari Birdeye untuk Analisa Teknikal.
     * @param {string} tokenAddress Alamat kontrak token.
     * @param {string} chain Nama jaringan (misal: 'solana').
     * @param {string} timeframe Timeframe (misal: '1H', '4H', '1D').
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getBirdeyeHistoricalData: async (tokenAddress, chain, timeframe) => {
        try {
            const now = new Date();
            let timeFrom;
            switch (timeframe) {
                case '4H': timeFrom = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); break; // 7 hari data
                case '1D': timeFrom = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)); break; // 60 hari data
                default: timeFrom = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)); break; // 3 hari data
            }
            const time_from_unix = Math.floor(timeFrom.getTime() / 1000);
            const time_to_unix = Math.floor(now.getTime() / 1000);

            const response = await axios.get(`https://public-api.birdeye.so/defi/history_price`, {
                params: { address: tokenAddress, address_type: 'token', type: timeframe, time_from: time_from_unix, time_to: time_to_unix },
                headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY, 'x-chain': chain }
            });
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.description || error.message;
            console.error(`[API Client] Gagal mengambil data Birdeye untuk ${tokenAddress}:`, errorMessage);
            return { success: false, error: `Gagal mengambil data historis dari Birdeye: ${errorMessage}` };
        }
    },
    
    /**
     * Mengambil data sentimen dari Stocktwits.
     * @param {string} symbol Simbol token (misal: 'SOL.X').
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getStocktwitsData: async (symbol) => {
        try {
            const response = await axios.get(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: 'Data tidak ditemukan di Stocktwits.' };
        }
    },
    
    /**
     * Mengambil data pencarian dari Reddit.
     * @param {string} query Kueri pencarian.
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getRedditData: async (query) => {
        try {
            const response = await axios.get(`https://www.reddit.com/r/solana+CryptoMoonShots+altcoin/search.json?q=${query}&sort=new&limit=100`, { 
                headers: { 'User-Agent': 'CryptonBot/1.0' } 
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: 'Gagal mengambil data dari Reddit.' };
        }
    },

    /**
     * Memvalidasi simbol dan mendapatkan nama lengkap dari Dexscreener.
     * @param {string} symbol Simbol token.
     * @returns {Promise<string>} Nama lengkap token.
     */
     getTokenName: async (symbol) => {
        try {
            const dexscreenerRes = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
            const pair = dexscreenerRes.data.pairs.find(p => p.baseToken.symbol.toUpperCase() === symbol.toUpperCase());
            return pair ? pair.baseToken.name : symbol;
        } catch (e) {
            console.log(`[API Client] Tidak dapat memvalidasi simbol ${symbol} di Dexscreener, melanjutkan dengan simbol saja.`);
            return symbol;
        }
    },
};

module.exports = apiClient;
