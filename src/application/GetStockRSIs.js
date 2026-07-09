const debug = require('debug')('folioflow:rsi')
const { RSI } = require('technicalindicators')

const RSI_PERIODS = [22, 44, 66]

/**
 * Computes the start_date / end_date span of bars that contributed to one RSI period.
 * The first computable RSI(period) lands on bar index `period` (0-indexed = period-1),
 * so start_date is bars[period-1].date and end_date is the date of the last bar.
 *
 * @param {Array<{date: string, close: number}>} bars - Chronologically ordered bars.
 * @param {number} period - RSI look-back period.
 * @param {number} rsiLength - Number of RSI values produced (0 when too few bars).
 * @returns {{start_date: string, end_date: string} | null} The window span, or null when no RSI was computable.
 */
function computeWindow(bars, period, rsiLength) {
    if (rsiLength === 0)
        return null
    const startIdx = (bars?.length - 1) - period
    const endIdx = bars.length - 1

    debug({ startIdx, endIdx, period, rsiLength, bar_len: bars?.length })
    return {
        start_date: (startIdx >= 1 && bars[startIdx]?.date) ? bars[startIdx]?.date : null,
        end_date: (endIdx >= 1 && bars[endIdx]?.date) ? bars[endIdx]?.date : null,
    }
}

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
     * Fetches historical bars, calculates RSI(22, 44, 66), and emits the full window-aware result.
     *
     * @param {string} symbol - The stock ticker symbol (e.g., 'AAPL').
     * @returns {Promise<{
     *   generated_at: string,
     *   symbol: string,
     *   rsi_22: number | null,
     *   rsi_44: number | null,
     *   rsi_66: number | null,
     *   rsi_avg: number | null,
     *   rsi_22_window: {start_date: string, end_date: string} | null,
     *   rsi_44_window: {start_date: string, end_date: string} | null,
     *   rsi_66_window: {start_date: string, end_date: string} | null
     * }>} The result payload.
     * @throws {Error} If calculation or data fetching fails.
     */
    async execute(symbol) {
        try {
            const bars = await this.financeAdapter.getHistoricalPrices(symbol)
            debug('bar', bars)
            const prices = bars.map(b => b.close)

            const rsiSeries = {}
            const rsiCurrent = {}
            const rsiWindows = {}
            for (const period of RSI_PERIODS) {
                const series = RSI.calculate({ values: prices, period })
                rsiSeries[period] = series
                rsiCurrent[`rsi_${period}`] = series.length > 0
                    ? Number(series[series.length - 1].toFixed(2))
                    : null
                rsiWindows[`rsi_${period}_window`] = computeWindow(bars, period, series.length)
            }

            const valids = Object.values(rsiCurrent).filter(v => typeof v === 'number' && !Number.isNaN(v))
            const rsi_avg = valids.length > 0
                ? Number((valids.reduce((a, b) => a + b, 0) / valids.length).toFixed(2))
                : null

            return {
                generated_at: new Date().toISOString(),
                symbol,
                rsi_22: rsiCurrent.rsi_22,
                rsi_44: rsiCurrent.rsi_44,
                rsi_66: rsiCurrent.rsi_66,
                rsi_avg,
                rsi_22_window: rsiWindows.rsi_22_window,
                rsi_44_window: rsiWindows.rsi_44_window,
                rsi_66_window: rsiWindows.rsi_66_window,
            }
        }
        catch (error) {
            throw new Error(`Failed to execute GetStockRSIs for '${symbol}': ${error.message}`)
        }
    }
}

module.exports = GetStockRSIs
