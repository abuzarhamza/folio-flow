const xlsx = require('xlsx')

/**
 * Adapter to fetch and parse the State Street SPY holdings Excel file.
 */
class SPYHoldingsAdapter {
    constructor() {
        this.url = 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx'
    }

    /**
     * Fetches the SPY holdings excel file and extracts the ticker symbols.
     * @returns {Promise<string[]>} Array of ticker symbols.
     */
    async fetchTickers() {
        const response = await fetch(this.url)
        if (!response.ok) {
            throw new Error(`Failed to fetch SPY holdings: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        return this.parseExcelBuffer(buffer)
    }

    /**
     * Parses the raw Excel buffer to extract ticker symbols.
     * @param {Buffer} buffer - Raw .xlsx file contents.
     * @returns {string[]} Array of ticker symbols, in row order.
     */
    parseExcelBuffer(buffer) {
        const workbook = xlsx.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Convert to 2D array
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 })
        const symbols = []

        // The SPY sheet has headers often around row 4 or 5.
        // The "Ticker" column is usually present. We just look for standard symbols.
        for (const row of rows) {
            if (Array.isArray(row)) {
                // Ticker is usually in the second or third column, but we can just look at row[0] or row[1]
                // Actually State Street usually has Name, Ticker, Identifier...
                // Let's find the Ticker column index by looking for "Ticker"
                const tickerColIndex = row.findIndex(c => typeof c === 'string' && c.toUpperCase() === 'TICKER')
                if (tickerColIndex !== -1 && !this.tickerIndex) {
                    this.tickerIndex = tickerColIndex
                    continue
                }

                if (this.tickerIndex !== undefined && row[this.tickerIndex]) {
                    const symbol = String(row[this.tickerIndex]).trim()
                    // Filter out rows that are not valid symbols (like cash totals)
                    if (symbol && /^[A-Z-]+$/.test(symbol) && symbol !== 'TICKER') {
                        symbols.push(symbol)
                    }
                }
            }
        }

        return symbols
    }
}

module.exports = SPYHoldingsAdapter
