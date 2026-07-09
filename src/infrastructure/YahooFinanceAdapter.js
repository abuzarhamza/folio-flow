const YahooFinance = require('yahoo-finance2').default

const yahooFinance = new YahooFinance()
const debug = require('debug')('folioflow:api')
const { RateLimitError } = require('../errors')

const TRANSIENT_MESSAGE_PATTERNS = [
    /<!doctype\s+html/i,
    /<html[\s>]/i,
    /rate\s*limit/i,
    /too\s*many\s*requests/i,
]

function isTransientYahooError(error) {
    const status = error && (error.status || error.statusCode || (error.response && error.response.status))
    if (status === 429 || status === 503)
        return true
    const message = (error && error.message) || ''
    return TRANSIENT_MESSAGE_PATTERNS.some(re => re.test(message))
}

/**
 * Normalises a Yahoo Finance `quote.date` (a `Date` instance in yahoo-finance2) into a
 * YYYY-MM-DD string. If the value is already a string we just slice off the time part.
 * Falls back to a best-effort string conversion for anything else.
 *
 * @param {Date|string} value
 * @returns {string} A YYYY-MM-DD date string, or '' if the value cannot be normalised.
 */
function toDateString(value) {
    if (value instanceof Date)
        return value.toISOString().split('T')[0]
    if (typeof value === 'string')
        return value.split('T')[0]
    return String(value).split('T')[0] || ''
}

/**
 * Infrastructure adapter to interact with the Yahoo Finance API.
 */
class YahooFinanceAdapter {
    /**
     * Initializes the adapter and defines the time range for historical queries.
     */
    constructor() {
        /**
         * @type {number} One year represented in milliseconds.
         */
        this.oneYearMs = 365 * 24 * 60 * 60 * 1000
    }

    /**
     * Retrieves historical closing prices and their bar dates for a given stock symbol for the last 1 year.
     *
     * @param {string} symbol - The stock ticker symbol (e.g., 'AAPL').
     * @returns {Promise<Array<{date: string, close: number}>>} An array of {date, close} bars in
     *   chronological order, where `date` is a YYYY-MM-DD string. Bars with a null/undefined close
     *   or a null/missing date are dropped.
     * @throws {RateLimitError} When Yahoo is throttling the request (HTML body, HTTP 429, etc.).
     * @throws {Error} For any other failure (e.g. symbol not found, malformed JSON).
     */
    async getHistoricalPrices(symbol) {
        try {
            debug(`Querying YahooFinance historical API for '${symbol}'`)
            const period1 = new Date(Date.now() - this.oneYearMs).toISOString().split('T')[0]
            const result = await yahooFinance.chart(symbol, { period1 })
            debug(`Successfully retrieved historical matrix array boundary for '${symbol}' (N=${result?.quotes?.length})`)
            return result.quotes
                .filter(quote => quote && quote.date != null && quote.close != null)
                .map(quote => ({
                    date: toDateString(quote.date),
                    close: quote.close,
                }))
        }
        catch (error) {
            if (isTransientYahooError(error)) {
                debug(`Yahoo rate-limited '${symbol}': ${(error.message || '').slice(0, 200)}`)
                throw new RateLimitError('Yahoo Finance is throttling the request. Will retry.')
            }
            if (error.message && error.message.includes('Not Found')) {
                debug(`Yahoo API evaluated '${symbol}' as Not Found. Returning specific namespace Error.`)
                throw new Error(`Symbol '${symbol}' not found.`)
            }
            debug(`Untracked Yahoo API system error for '${symbol}': ${error.message}`)
            throw new Error(`Error fetching data for '${symbol}': ${error.message}`)
        }
    }
}

module.exports = YahooFinanceAdapter
