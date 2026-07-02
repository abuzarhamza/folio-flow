const debug = require('debug')('folioflow:batch')

/**
 * Application service orchestrating batch execution of RSI calculation with rate-limiting.
 */
class BatchCalculateRSIs {
    /**
     * Constructs the Batch processor.
     * @param {object} getStockRSIsService - The service responsible for single stock calculations.
     */
    constructor(getStockRSIsService) {
        this.getStockRSIsService = getStockRSIsService
    }

    /**
     * Executes calculations sequentially over an array of symbols with 1 sec delays.
     * @param {string[]} symbols - Ticker symbols to process.
     * @returns {Promise<object[]>} Array of RSI result objects, sorted by rsi_avg desc.
     */
    async execute(symbols) {
        const results = []
        debug(`Initializing batch execution pipeline for ${symbols.length} items`)

        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i]
            debug(`(${i + 1}/${symbols.length}) Processing symbol: ${symbol}`)

            try {
                const result = await this.getStockRSIsService.execute(symbol)
                results.push(result)
            }
            catch (error) {
                debug(`Failure caught targeting ${symbol}. Skipping to next. Message: ${error.message}`)
                results.push({ symbol, error: error.message })
            }

            // Add a 1 second delay between requests, except after the final one
            if (i < symbols.length - 1) {
                debug(`Suspending network execution for 1000ms`)
                await new Promise(r => setTimeout(r, 1000))
            }
        }

        debug(`Batch execution pipeline completed. Processed ${results.length} items.`)
        results.sort((a, b) => (b?.rsi_avg || 0) - (a?.rsi_avg || 0))
        return results
    }
}

module.exports = BatchCalculateRSIs
