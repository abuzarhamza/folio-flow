const YahooFinance = require('yahoo-finance2').default

const yahooFinance = new YahooFinance()
const debug = require('debug')('folioflow:api')

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
     * Retrieves historical closing prices for a given stock symbol for the last 1 year.
     *
     * @param {string} symbol - The stock ticker symbol (e.g., 'AAPL').
     * @returns {Promise<number[]>} An array of closing prices in chronological order.
     * @throws {Error} If the symbol is invalid or the network request fails.
     */
    async getHistoricalPrices(symbol) {
        try {
            debug(`Querying YahooFinance historical API for '${symbol}'`)
            const period1 = new Date(Date.now() - this.oneYearMs).toISOString().split('T')[0]
            const result = await yahooFinance.chart(symbol, { period1 })
            debug(`Successfully retrieved historical matrix array boundary for '${symbol}' (N=${result?.quotes?.length})`)
            return result.quotes.map(quote => quote.close).filter(c => c !== null && c !== undefined)
        }
        catch (error) {
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
