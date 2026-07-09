const { RateLimitError } = require('../errors')
const BatchCalculateRSIs = require('./BatchCalculateRSIs')

describe('batchCalculateRSIs', () => {
    let stderrSpy

    beforeEach(() => {
        jest.useFakeTimers()
        stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
    })

    afterEach(() => {
        jest.useRealTimers()
        stderrSpy.mockRestore()
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
            { symbol: 'MSFT', rsi_22: 60, rsi_44: 60, rsi_66: 60, rsi_avg: 60 },
            { symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 },
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
            { symbol: 'GOOG', rsi_22: 70, rsi_44: 70, rsi_66: 70, rsi_avg: 70 },
            { symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 },
            { symbol: 'INVALID', error: 'Network Error' },
        ])
    })

    it('emits a default-visible chalk-cyan trace on stderr for every ticker', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn()
                .mockResolvedValueOnce({ symbol: 'AAPL', rsi_22: 53.82, rsi_44: 55.67, rsi_66: 55.95, rsi_avg: 55.15 })
                .mockResolvedValueOnce({ symbol: 'MSFT', rsi_22: 64.03, rsi_44: 57.49, rsi_66: 56.06, rsi_avg: 59.19 }),
        }

        const batch = new BatchCalculateRSIs(mockGetStockRSIs)

        const executePromise = batch.execute(['AAPL', 'MSFT'])
        await jest.advanceTimersByTimeAsync(2000)
        await executePromise

        const lines = stderrSpy.mock.calls.map(c => c[0]).join('')
        expect(lines).toMatch(/\(1\/2\) AAPL → rsi_22=53\.82 rsi_44=55\.67 rsi_66=55\.95 rsi_avg=55\.15\n/)
        expect(lines).toMatch(/\(2\/2\) MSFT → rsi_22=64\.03 rsi_44=57\.49 rsi_66=56\.06 rsi_avg=59\.19\n/)
    })

    it('emits an error-shaped trace line for failed tickers', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn()
                .mockResolvedValueOnce({ symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 })
                .mockRejectedValueOnce(new Error('Network Error')),
        }

        const batch = new BatchCalculateRSIs(mockGetStockRSIs)

        const executePromise = batch.execute(['AAPL', 'INVALID'])
        await jest.advanceTimersByTimeAsync(2000)
        await executePromise

        const lines = stderrSpy.mock.calls.map(c => c[0]).join('')
        expect(lines).toMatch(/\(1\/2\) AAPL → /)
        expect(lines).toMatch(/\(2\/2\) INVALID → error=Network Error\n/)
    })

    it('retries on RateLimitError and succeeds on the second attempt', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn()
                .mockRejectedValueOnce(new RateLimitError('Yahoo Finance is throttling the request. Will retry.'))
                .mockResolvedValueOnce({ symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 }),
        }
        const batch = new BatchCalculateRSIs(mockGetStockRSIs)
        const executePromise = batch.execute(['AAPL'])
        await jest.advanceTimersByTimeAsync(6000)
        const result = await executePromise
        expect(mockGetStockRSIs.execute).toHaveBeenCalledTimes(2)
        expect(result).toEqual([{ symbol: 'AAPL', rsi_22: 50, rsi_44: 50, rsi_66: 50, rsi_avg: 50 }])
    })

    it('does not retry on non-RateLimitError (e.g. Symbol not found)', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn()
                .mockRejectedValueOnce(new Error('Symbol \'XXXX\' not found.')),
        }
        const batch = new BatchCalculateRSIs(mockGetStockRSIs)
        const result = await batch.execute(['XXXX'])
        expect(mockGetStockRSIs.execute).toHaveBeenCalledTimes(1)
        expect(result).toEqual([{ symbol: 'XXXX', error: 'Symbol \'XXXX\' not found.' }])
    })

    it('respects the retry budget — 3 retries then gives up', async () => {
        const mockGetStockRSIs = {
            execute: jest.fn().mockRejectedValue(new RateLimitError('Yahoo Finance is throttling the request. Will retry.')),
        }
        const batch = new BatchCalculateRSIs(mockGetStockRSIs)
        const executePromise = batch.execute(['AAPL'])
        // Total backoff: 5s + 15s + 45s = 65s, plus 1s of fake-timer headroom for jitter
        await jest.advanceTimersByTimeAsync(70000)
        const result = await executePromise
        // 1 initial attempt + 3 retries = 4 total calls
        expect(mockGetStockRSIs.execute).toHaveBeenCalledTimes(4)
        expect(result[0].error).toMatch(/throttling/)
    })
})
