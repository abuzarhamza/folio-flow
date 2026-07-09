const { FolioFlowError } = require('../errors')

/**
 * Application service for looking up symbols and browsing the top of
 * a `spy_rsi_results.json`-shaped object. The file shape is read by `getData`,
 * which the caller injects; the service is I/O-free.
 */
class SearchResults {
    /**
     * @param {() => { generated_at: string, tickers: object[] }} getData
     *   Returns the parsed results object (or throws if the file is missing/malformed).
     */
    constructor(getData) {
        this.getData = getData
    }

    /**
     * Returns the row whose `symbol` matches the given ticker.
     * @param {string} symbol
     * @returns {object} The matching row.
     * @throws {FolioFlowError} if the symbol is not in the file's tickers array.
     */
    findBySymbol(symbol) {
        if (typeof symbol !== 'string' || symbol.length === 0) {
            throw new FolioFlowError('Symbol must be a non-empty string')
        }
        const { tickers } = this.getData()
        const match = (tickers || []).find(row => row.symbol === symbol)
        if (!match) {
            throw new FolioFlowError(`Symbol ${symbol} not found in spy_rsi_results.json`)
        }
        return match
    }

    /**
     * Returns the first `n` rows of the file's tickers array. The file is
     * already sorted by `rsi_avg` desc, so this is the top-N by momentum.
     * @param {number} n Number of rows to return.
     * @returns {object[]} The first N rows of the file's tickers array.
     */
    topByRsiAvg(n) {
        const { tickers } = this.getData()
        if (!Array.isArray(tickers))
            return []
        return tickers.slice(0, n)
    }
}

module.exports = { SearchResults }
