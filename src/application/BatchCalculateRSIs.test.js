const BatchCalculateRSIs = require('./BatchCalculateRSIs')

describe('batchCalculateRSIs', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
        jest.clearAllMocks()
    })

    it('processes multiple symbols sequentially with a 1-second delay between them', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn()
                .mockResolvedValueOnce({ symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 })
                .mockResolvedValueOnce({ symbol: 'MSFT', rsi_22: 60, rsi_44: 60, rsi_66: 60, rsi_avg: 60 }),
        }

        const batch = new BatchCalculateRSIs(mockGetStockRSIs)

        const executePromise = batch.execute(['AAPL', 'MSFT'])

        // We can use advanceTimersByTimeAsync to handle awaited setTimeouts
        await jest.advanceTimersByTimeAsync(2000)

        const result = await executePromise

        expect(mockGetStockRSIs.execute).toHaveBeenCalledTimes(2)
        expect(result).toEqual([
            { symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 },
            { symbol: 'MSFT', rsi_22: 60, rsi_44: 60, rsi_66: 60, rsi_avg: 60 },
        ])
    })

    it('handles errors on individual stocks without crashing the whole batch', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn()
                .mockResolvedValueOnce({ symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 })
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValueOnce({ symbol: 'GOOG', rsi_22: 70, rsi_44: 70, rsi_66: 70, rsi_avg: 70 }),
        }

        const batch = new BatchCalculateRSIs(mockGetStockRSIs)

        const executePromise = batch.execute(['AAPL', 'INVALID', 'GOOG'])

        await jest.advanceTimersByTimeAsync(3000)

        const result = await executePromise

        expect(mockGetStockRSIs.execute).toHaveBeenCalledTimes(3)
        expect(result).toEqual([
            { symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 },
            { symbol: 'INVALID', error: 'Network Error' },
            { symbol: 'GOOG', rsi_22: 70, rsi_44: 70, rsi_66: 70, rsi_avg: 70 },
        ])
    })
})
