// __tests__/services/apiClient.test.js

const axios = require('axios');
const apiClient = require('../../services/apiClient');

// Mock axios secara spesifik untuk file tes ini.
jest.mock('axios');

describe('apiClient Service', () => {
  // Dijalankan setelah setiap tes untuk membersihkan state mock
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDexScreenerData', () => {
    test('should return success and data when API call is successful', async () => {
      const mockPair = { baseToken: { symbol: 'SOL' } };
      axios.get.mockResolvedValue({ data: { pairs: [mockPair] } });

      const result = await apiClient.getDexScreenerData('sol-address');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPair);
      expect(axios.get).toHaveBeenCalledWith('https://api.dexscreener.com/latest/dex/tokens/sol-address');
    });

    test('should return error when token is not found', async () => {
      axios.get.mockResolvedValue({ data: { pairs: null } });

      const result = await apiClient.getDexScreenerData('unknown-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token tidak ditemukan di DexScreener.');
    });

    test('should return error when API call fails', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      const result = await apiClient.getDexScreenerData('any-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gagal terhubung ke API DexScreener.');
    });
  });

  describe('getTokenName', () => {
      test('should return token name when found', async () => {
        const mockPairs = [{ baseToken: { symbol: 'SOL', name: 'Solana' } }];
        axios.get.mockResolvedValue({ data: { pairs: mockPairs } });

        const name = await apiClient.getTokenName('SOL');

        expect(name).toBe('Solana');
        expect(axios.get).toHaveBeenCalledWith('https://api.dexscreener.com/latest/dex/search?q=SOL');
      });

      test('should return symbol when token name is not found', async () => {
        axios.get.mockResolvedValue({ data: { pairs: [] } });
        
        const name = await apiClient.getTokenName('UNKNOWN');
        
        expect(name).toBe('UNKNOWN');
      });
  });
});
