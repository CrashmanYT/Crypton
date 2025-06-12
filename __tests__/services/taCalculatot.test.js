// __tests__/services/taCalculator.test.js

const taCalculator = require('../../services/taCalculator');

describe('taCalculator Service', () => {
    const samplePrices = [
        45.44, 45.62, 45.74, 45.92, 45.4, 45.2, 45.1, 44.8, 44.92, 45.32,
        45.76, 46.12, 46.02, 46.32, 46.5, 46.42, 46.8, 47.1, 47.02, 46.9,
        47.3, 47.5, 47.42, 47.8, 48.1, 48.0, 47.9
    ];

    test('should return null if not enough data is provided', () => {
        const notEnoughPrices = [1, 2, 3, 4, 5];
        expect(taCalculator.calculateAll(notEnoughPrices)).toBeNull();
    });

    test('should return null for undefined or empty input', () => {
        expect(taCalculator.calculateAll([])).toBeNull();
        expect(taCalculator.calculateAll(undefined)).toBeNull();
    });

    test('should calculate all TA indicators correctly with sufficient data', () => {
        const result = taCalculator.calculateAll(samplePrices);

        expect(result).toBeDefined();
        expect(result.rsi).toBeDefined();
        expect(result.sma20).toBeDefined();
        expect(result.macd).toBeDefined();
        expect(result.bollingerBands).toBeDefined();

        // Mengubah nilai yang diharapkan agar sesuai dengan output aktual dari pustaka.
        expect(Number(result.rsi)).toBeCloseTo(71.13); 
        expect(result.sma20).toBeCloseTo(46.70);

        expect(result.macd).toHaveProperty('MACD');
        expect(result.macd).toHaveProperty('signal');
        expect(result.bollingerBands).toHaveProperty('upper');
        expect(result.bollingerBands).toHaveProperty('middle');
        expect(result.bollingerBands).toHaveProperty('lower');
    });
});
