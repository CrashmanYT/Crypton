// services/taCalculator.js
// Modul khusus untuk semua perhitungan Analisa Teknikal.

const { RSI, SMA, MACD, BollingerBands } = require('technicalindicators');

const taCalculator = {
    /**
     * Menghitung semua indikator TA dari serangkaian harga penutupan.
     * @param {number[]} closingPrices Array harga penutupan.
     * @returns {object|null} Objek berisi hasil TA atau null jika data tidak cukup.
     */
    calculateAll: (closingPrices) => {
        if (!closingPrices || closingPrices.length < 26) { // Butuh minimal 26 data point untuk MACD
            return null;
        }
        
        const taData = {};
        
        taData.rsi = RSI.calculate({ values: closingPrices, period: 14 }).pop()?.toFixed(2);
        taData.sma20 = SMA.calculate({ values: closingPrices, period: 20 }).pop();
        taData.macd = MACD.calculate({ values: closingPrices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, TEMA: false }).pop();
        taData.bollingerBands = BollingerBands.calculate({ values: closingPrices, period: 20, stdDev: 2 }).pop();
        
        return taData;
    }
};

module.exports = taCalculator;
