const GetStockRSIs = require('./GetStockRSIs')

describe('getStockRSIs', () => {
    it('calculates RSI 22, 44, and 66 correctly and returns JSON-compatible format', async () => {
    // Generate 100 days of dummy data
        const dummyPrices = Array.from({ length: 100 }, (_, i) => 100 + i)

        const mockAdapter = {
            getHistoricalPrices: jest.fn().mockResolvedValue(dummyPrices),
        }

        const service = new GetStockRSIs(mockAdapter)
        const result = await service.execute('TEST_SYMBOL')

        expect(mockAdapter.getHistoricalPrices).toHaveBeenCalledWith(
            'TEST_SYMBOL',
        )

        expect(result).toHaveProperty('symbol', 'TEST_SYMBOL')
        expect(typeof result.rsi_22).toBe('number')
        expect(typeof result.rsi_44).toBe('number')
        expect(typeof result.rsi_66).toBe('number')
        expect(typeof result.rsi_avg).toBe('number')
    })

    it('calculates fallback rsi_avg dynamically if older historical periods are unavailable', async () => {
    // Generate only 30 days of data (enough for 22, but not 44 or 66)
        const dummyPrices = Array.from({ length: 30 }, (_, i) => 100 + i)

        const mockAdapter = {
            getHistoricalPrices: jest.fn().mockResolvedValue(dummyPrices),
        }

        const service = new GetStockRSIs(mockAdapter)
        const result = await service.execute('TEST_SYMBOL')

        expect(result.rsi_22).toBeDefined()
        expect(result.rsi_44).toBeNull()
        expect(result.rsi_66).toBeNull()
        expect(result.rsi_avg).toBe(result.rsi_22) // average of one is just the number itself
    })

    it('throws a domain-level error if the adapter throws', async () => {
        const mockAdapter = {
            getHistoricalPrices: jest
                .fn()
                .mockRejectedValue(new Error('Network Error')),
        }

        const service = new GetStockRSIs(mockAdapter)

        await expect(service.execute('TEST_SYMBOL')).rejects.toThrow(
            'Failed to execute GetStockRSIs for \'TEST_SYMBOL\': Network Error',
        )
    })
})
