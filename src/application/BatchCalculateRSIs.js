const debug = require('debug')('folioflow:batch')
const chalk = require('chalk')
const { RateLimitError } = require('../errors')

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [5000, 15000, 45000]
const RETRY_JITTER_MS = 1000

function jitterMs() {
    return Math.floor(Math.random() * RETRY_JITTER_MS)
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
}

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
     * Retries up to MAX_RETRIES times on RateLimitError with exponential backoff.
     * @param {string[]} symbols - Ticker symbols to process.
     * @returns {Promise<object[]>} Array of RSI result objects, sorted by rsi_avg desc.
     */
    async execute(symbols) {
        const results = []
        const total = symbols.length
        debug(`Initializing batch execution pipeline for ${total} items`)

        for (let i = 0; i < total; i++) {
            const symbol = symbols[i]
            const { result, error } = await this.processTicker(symbol, i, total)

            if (result) {
                results.push(result)
                process.stderr.write(
                    chalk.cyan(`(${i + 1}/${total}) ${symbol} → rsi_22=${result.rsi_22} rsi_44=${result.rsi_44} rsi_66=${result.rsi_66} rsi_avg=${result.rsi_avg}\n`),
                )
            }
            else {
                results.push({ symbol, error: error.message })
                process.stderr.write(
                    chalk.cyan(`(${i + 1}/${total}) ${symbol} → error=${error.message}\n`),
                )
            }

            // Add a 1 second delay between requests, except after the final one
            if (i < total - 1) {
                debug(`Suspending network execution for 1000ms`)
                await sleep(1000)
            }
        }

        debug(`Batch execution pipeline completed. Processed ${results.length} items.`)
        results.sort((a, b) => (b?.rsi_avg || 0) - (a?.rsi_avg || 0))
        return results
    }

    /**
     * Runs a single ticker through the inner service, retrying on RateLimitError.
     * Returns the resolved row or the final error after the retry budget is exhausted.
     * @param {string} symbol Ticker symbol to process.
     * @param {number} index Zero-based index of the symbol in the batch.
     * @param {number} total Total number of symbols in the batch.
     * @returns {Promise<{result?: object, error?: Error}>} Resolved row or final error.
     */
    async processTicker(symbol, index, total) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await this.getStockRSIsService.execute(symbol)
                return { result }
            }
            catch (error) {
                if (error instanceof RateLimitError && attempt < MAX_RETRIES) {
                    const baseDelay = RETRY_DELAYS_MS[attempt]
                    const delay = baseDelay + jitterMs()
                    process.stderr.write(
                        chalk.yellow(`(${index + 1}/${total}) ${symbol} — retrying in ${Math.round(baseDelay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES}, rate-limited)\n`),
                    )
                    await sleep(delay)
                    continue
                }
                return { error }
            }
        }
        return { error: new RateLimitError('Yahoo Finance is throttling the request. Will retry.') }
    }
}

module.exports = BatchCalculateRSIs
