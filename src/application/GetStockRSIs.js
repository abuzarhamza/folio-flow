const { RSI } = require('technicalindicators')

/**
 * Application service orchestrating the fetch and calculation of stock RSI indicators.
 */
class GetStockRSIs {
    /**
     * Constructs the Application Service with an injected data adapter.
     *
     * @param {object} financeAdapter - The injected infrastructure adapter for fetching financial data.
     */
    constructor(financeAdapter) {
        this.financeAdapter = financeAdapter
    }

    /**
     * Fetches historical closing prices and calculates RSI variants (22, 44, 66).
     *
     * @param {string} symbol - The stock ticker symbol (e.g., 'AAPL').
     * @returns {Promise<{symbol: string, rsi_22: number, rsi_44: number, rsi_66: number}>} JSON payload containing indicator values.
     * @throws {Error} If calculation or data fetching fails.
     */
    async execute(symbol) {
        try {
            const prices = await this.financeAdapter.getHistoricalPrices(symbol)

            const rsi22Arr = RSI.calculate({ values: prices, period: 22 })
            const rsi44Arr = RSI.calculate({ values: prices, period: 44 })
            const rsi66Arr = RSI.calculate({ values: prices, period: 66 })

            const rsi_22 = rsi22Arr.length > 0 ? Number(rsi22Arr[rsi22Arr.length - 1].toFixed(2)) : null
            const rsi_44 = rsi44Arr.length > 0 ? Number(rsi44Arr[rsi44Arr.length - 1].toFixed(2)) : null
            const rsi_66 = rsi66Arr.length > 0 ? Number(rsi66Arr[rsi66Arr.length - 1].toFixed(2)) : null

            // Extract valid metrics
            const valids = [rsi_22, rsi_44, rsi_66].filter(val => typeof val === 'number' && !Number.isNaN(val))
            const rsi_avg = valids.length > 0
                ? Number((valids.reduce((a, b) => a + b, 0) / valids.length).toFixed(2))
                : null

            return {
                symbol,
                rsi_22,
                rsi_44,
                rsi_66,
                rsi_avg,
            }
        }
        catch (error) {
            throw new Error(`Failed to execute GetStockRSIs for '${symbol}': ${error.message}`)
        }
    }
}

module.exports = GetStockRSIs
