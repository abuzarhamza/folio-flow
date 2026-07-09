// Mock the yahoo-finance2 module before requiring the adapter.
jest.mock('yahoo-finance2', () => {
    const chart = jest.fn()
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({ chart })),
    }
})

const { RateLimitError } = require('../errors')
const YahooFinanceAdapter = require('./YahooFinanceAdapter')
const YahooFinance = require('yahoo-finance2').default

function makeChartError(payload) {
    return new Error(payload)
}

async function expectRejection(adapter, chart, payload, klass) {
    chart.mockRejectedValueOnce(payload)
    let caught
    try {
        await adapter.getHistoricalPrices('AAPL')
    }
    catch (e) {
        caught = e
    }
    expect(caught).toBeInstanceOf(klass)
    return caught
}

describe('yahooFinanceAdapter', () => {
    let adapter
    let chart

    beforeEach(() => {
        adapter = new YahooFinanceAdapter()
        chart = YahooFinance().chart
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('throws RateLimitError when the response body starts with <!doctype html', async () => {
        const caught = await expectRejection(
            adapter,
            chart,
            makeChartError('<!doctype html public "-//W3C//DTD HTML 4.01//EN" ...'),
            RateLimitError,
        )
        expect(caught.message).toMatch(/throttling/)
    })

    it('throws RateLimitError on HTTP 429 status', async () => {
        const err = new Error('Too many requests')
        err.status = 429
        await expectRejection(adapter, chart, err, RateLimitError)
    })

    it('throws RateLimitError on HTTP 503 status', async () => {
        const err = new Error('Service unavailable')
        err.status = 503
        await expectRejection(adapter, chart, err, RateLimitError)
    })

    it('throws RateLimitError when the message contains "rate limit"', async () => {
        await expectRejection(
            adapter,
            chart,
            makeChartError('You have hit the rate limit for this endpoint.'),
            RateLimitError,
        )
    })

    it('rateLimitError message is short — does NOT include the verbose HTML body', async () => {
        const verbose = '<!doctype html public "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">...1500 chars...'
        const caught = await expectRejection(adapter, chart, makeChartError(verbose), RateLimitError)
        expect(caught.message).not.toMatch(/<!?doctype/i)
        expect(caught.message.length).toBeLessThan(100)
    })

    it('throws a generic Error for symbol not found (non-transient)', async () => {
        chart.mockRejectedValueOnce(makeChartError('Not Found'))
        let caught
        try {
            await adapter.getHistoricalPrices('XXXX')
        }
        catch (e) {
            caught = e
        }
        expect(caught).toBeDefined()
        expect(caught.message).toMatch(/not found/i)
        expect(caught).not.toBeInstanceOf(RateLimitError)
    })

    it('throws a generic Error for other failures (non-transient)', async () => {
        chart.mockRejectedValueOnce(makeChartError('Connection reset'))
        let caught
        try {
            await adapter.getHistoricalPrices('AAPL')
        }
        catch (e) {
            caught = e
        }
        expect(caught).toBeDefined()
        expect(caught.message).toMatch(/Error fetching data/)
        expect(caught).not.toBeInstanceOf(RateLimitError)
    })

    it('returns {date, close} bars on success, dropping null closes and null/missing dates, and normalises Date objects and ISO strings to YYYY-MM-DD', async () => {
        // yahoo-finance2 actually returns Date instances for quote.date. The adapter must
        // convert them to YYYY-MM-DD strings (not call String(date), which would yield
        // "Thu Aug 07 2025 08:30:00 GM" because the first 'T' is in 'Thu' / 'GMT').
        chart.mockResolvedValueOnce({
            quotes: [
                { date: new Date('2025-09-10T13:30:00.000Z'), close: 100 },
                { date: new Date('2025-09-11T13:30:00.000Z'), close: 101 },
                { date: new Date('2025-09-12T13:30:00.000Z'), close: null },
                { date: null, close: 99 },
                { date: new Date('2025-09-15T13:30:00.000Z'), close: 102 },
                // A string date (defensive — some upstream paths may serialise before we see it)
                { date: '2025-09-16T13:30:00.000Z', close: 103 },
            ],
        })
        const result = await adapter.getHistoricalPrices('AAPL')
        expect(result).toEqual([
            { date: '2025-09-10', close: 100 },
            { date: '2025-09-11', close: 101 },
            { date: '2025-09-15', close: 102 },
            { date: '2025-09-16', close: 103 },
        ])
    })
})
