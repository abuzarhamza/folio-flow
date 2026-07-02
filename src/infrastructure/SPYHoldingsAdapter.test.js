const xlsx = require('xlsx')
const SPYHoldingsAdapter = require('./SPYHoldingsAdapter')

describe('sPYHoldingsAdapter', () => {
    it('parses an excel buffer correctly for ticker symbols', () => {
        const adapter = new SPYHoldingsAdapter()

        // Create a dummy workbook
        const ws = xlsx.utils.aoa_to_sheet([
            ['Fund Name', 'SPDR S&P 500 ETF Trust'],
            ['Date', '05-Jan-2025'],
            [],
            ['Name', 'Ticker', 'Identifier', 'Weight'],
            ['Apple Inc.', 'AAPL', '037833100', '6.5'],
            ['Microsoft Corp.', 'MSFT', '594918104', '6.0'],
            ['Invalid row without ticker'], // Should be ignored
            ['Cash', 'CASH_USD', '-', '0.1'], // Might fail regex, should test
        ])
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Holdings')

        const buffer = xlsx.write(wb, { type: 'buffer' })

        const symbols = adapter.parseExcelBuffer(buffer)

        // ONLY AAPL and MSFT match our expected regex /^[A-Z-]+$/ and actually exist under Ticker
        expect(symbols).toEqual(['AAPL', 'MSFT'])
    })
})
