const { FolioFlowError } = require('../errors')
const { SearchResults } = require('./SearchResults')

const SAMPLE_DATA = {
    generated_at: '2026-07-05T14:23:45.678Z',
    tickers: [
        { symbol: 'AAPL', rsi_22: 53.82, rsi_44: 55.67, rsi_66: 55.95, rsi_avg: 55.15 },
        { symbol: 'MSFT', rsi_22: 64.03, rsi_44: 57.49, rsi_66: 56.06, rsi_avg: 59.19 },
        { symbol: 'GOOGL', rsi_22: 70.00, rsi_44: 71.00, rsi_66: 72.00, rsi_avg: 71.00 },
    ],
}

describe('searchResults', () => {
    describe('findBySymbol', () => {
        it('returns the row when the symbol is in the file', () => {
            const service = new SearchResults(() => SAMPLE_DATA)
            const result = service.findBySymbol('AAPL')
            expect(result).toEqual(SAMPLE_DATA.tickers[0])
        })

        it('throws FolioFlowError when the symbol is not in the file', () => {
            const service = new SearchResults(() => SAMPLE_DATA)
            expect(() => service.findBySymbol('ZZZZ')).toThrow(FolioFlowError)
            expect(() => service.findBySymbol('ZZZZ')).toThrow(/Symbol ZZZZ not found/)
        })

        it('throws FolioFlowError when the file has no tickers', () => {
            const service = new SearchResults(() => ({ generated_at: '...', tickers: [] }))
            expect(() => service.findBySymbol('AAPL')).toThrow(FolioFlowError)
        })

        it('throws FolioFlowError when the symbol is not a non-empty string', () => {
            const service = new SearchResults(() => SAMPLE_DATA)
            expect(() => service.findBySymbol('')).toThrow(FolioFlowError)
        })
    })

    describe('topByRsiAvg', () => {
        it('returns the first N rows when N < total', () => {
            const service = new SearchResults(() => SAMPLE_DATA)
            const result = service.topByRsiAvg(2)
            expect(result).toEqual([SAMPLE_DATA.tickers[0], SAMPLE_DATA.tickers[1]])
        })

        it('returns all rows when N >= total', () => {
            const service = new SearchResults(() => SAMPLE_DATA)
            const result = service.topByRsiAvg(100)
            expect(result).toEqual(SAMPLE_DATA.tickers)
        })

        it('returns an empty array when the file has no tickers', () => {
            const service = new SearchResults(() => ({ generated_at: '...', tickers: [] }))
            const result = service.topByRsiAvg(5)
            expect(result).toEqual([])
        })
    })
})
