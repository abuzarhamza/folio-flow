const GetStockRSIs = require('./GetStockRSIs')

function makeBars(count, startDate = '2025-01-01') {
    const base = new Date(startDate).getTime()
    const oneDay = 24 * 60 * 60 * 1000
    return Array.from({ length: count }, (_, i) => ({
        date: new Date(base + i * oneDay).toISOString().split('T')[0],
        close: 100 + i,
    }))
}

// Helper that exercises computeWindow's guard rails directly, without going through the
// service. computeWindow is intentionally not exported, so we re-derive the expected
// window from the same arithmetic it uses:
//   startIdx = (bars.length - 1) - period
//   endIdx   = bars.length - 1
// If startIdx < 1, start_date is null; if endIdx < 1, end_date is null.
function expectedWindow(bars, period) {
    const endIdx = bars.length - 1
    if (bars.length === 0)
        return null
    const startIdx = (bars.length - 1) - period
    return {
        start_date: startIdx >= 1 ? bars[startIdx]?.date : null,
        end_date: endIdx >= 1 ? bars[endIdx]?.date : null,
    }
}

describe('getStockRSIs', () => {
    it('calculates RSI 22, 44, and 66 and returns the full window-aware shape', async () => {
        const bars = makeBars(100)
        const mockAdapter = {
            getHistoricalPrices: jest.fn().mockResolvedValue(bars),
        }

        const service = new GetStockRSIs(mockAdapter)
        const result = await service.execute('TEST_SYMBOL')

        expect(mockAdapter.getHistoricalPrices).toHaveBeenCalledWith('TEST_SYMBOL')

        expect(result).toHaveProperty('symbol', 'TEST_SYMBOL')
        expect(typeof result.rsi_22).toBe('number')
        expect(typeof result.rsi_44).toBe('number')
        expect(typeof result.rsi_66).toBe('number')
        expect(typeof result.rsi_avg).toBe('number')

        // generated_at is a valid ISO 8601 timestamp
        expect(typeof result.generated_at).toBe('string')
        expect(new Date(result.generated_at).toString()).not.toBe('Invalid Date')

        // Windows describe the trailing `period`-bar span that ends at the last bar:
        // start_idx = (bars.length - 1) - period, end_idx = bars.length - 1.
        expect(result.rsi_22_window).toEqual(expectedWindow(bars, 22))
        expect(result.rsi_44_window).toEqual(expectedWindow(bars, 44))
        expect(result.rsi_66_window).toEqual(expectedWindow(bars, 66))

        // Concrete values for the 100-bar fixture (length 100, indices 0..99):
        //   period 22 -> startIdx = 99 - 22 = 77
        //   period 44 -> startIdx = 99 - 44 = 55
        //   period 66 -> startIdx = 99 - 66 = 33
        expect(result.rsi_22_window).toEqual({ start_date: bars[77].date, end_date: bars[99].date })
        expect(result.rsi_44_window).toEqual({ start_date: bars[55].date, end_date: bars[99].date })
        expect(result.rsi_66_window).toEqual({ start_date: bars[33].date, end_date: bars[99].date })
    })

    it('returns null windows when the adapter yields no computable RSI', async () => {
        // 30 bars is enough for RSI(22) (8 values) but not for 44 or 66 (0 values).
        // When rsiLength === 0, computeWindow short-circuits to a fully-null window.
        const bars = makeBars(30)
        const mockAdapter = {
            getHistoricalPrices: jest.fn().mockResolvedValue(bars),
        }

        const service = new GetStockRSIs(mockAdapter)
        const result = await service.execute('TEST_SYMBOL')

        expect(result.rsi_22).toBeDefined()
        expect(result.rsi_44).toBeNull()
        expect(result.rsi_66).toBeNull()
        expect(result.rsi_avg).toBe(result.rsi_22)

        // period 22 with 30 bars: startIdx = 29 - 22 = 7 -> valid trailing window
        expect(result.rsi_22_window).toEqual({ start_date: bars[7].date, end_date: bars[29].date })
        // period 44/66: RSI returns 0 values -> both windows are fully null
        expect(result.rsi_44_window).toBeNull()
        expect(result.rsi_66_window).toBeNull()
    })

    it('returns a fully-null window when there is no data at all (rsiLength === 0)', async () => {
        // 0 bars -> both rsi values and all three windows must be null.
        const mockAdapter = {
            getHistoricalPrices: jest.fn().mockResolvedValue([]),
        }

        const service = new GetStockRSIs(mockAdapter)
        const result = await service.execute('TEST_SYMBOL')

        expect(result.rsi_22).toBeNull()
        expect(result.rsi_44).toBeNull()
        expect(result.rsi_66).toBeNull()
        expect(result.rsi_avg).toBeNull()
        expect(result.rsi_22_window).toBeNull()
        expect(result.rsi_44_window).toBeNull()
        expect(result.rsi_66_window).toBeNull()
    })

    it('treats a single-bar array as no-history (end_date set, start_date null for any period)', async () => {
        // The guard `>= 1` means a length-1 array (endIdx = 0) cannot emit end_date either.
        // Both guards fire -> all three windows are fully null because endIdx < 1.
        const bars = makeBars(1)
        const mockAdapter = {
            getHistoricalPrices: jest.fn().mockResolvedValue(bars),
        }

        const service = new GetStockRSIs(mockAdapter)
        const result = await service.execute('TEST_SYMBOL')

        expect(result.rsi_22_window).toBeNull()
        expect(result.rsi_44_window).toBeNull()
        expect(result.rsi_66_window).toBeNull()
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
