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

    it('isJunkSymbol returns true for the deny-list values and false otherwise', () => {
        const adapter = new SPYHoldingsAdapter()
        expect(adapter.isJunkSymbol('-')).toBe(true)
        expect(adapter.isJunkSymbol('')).toBe(true)
        expect(adapter.isJunkSymbol(null)).toBe(true)
        expect(adapter.isJunkSymbol(undefined)).toBe(true)
        expect(adapter.isJunkSymbol('null')).toBe(true)
        expect(adapter.isJunkSymbol('AAPL')).toBe(false)
        expect(adapter.isJunkSymbol('BRK.B')).toBe(false)
    })

    it('parseExcelBuffer drops junk-symbol rows ("-", "", null, "CASH_USD") and keeps real tickers', () => {
        const adapter = new SPYHoldingsAdapter()

        const ws = xlsx.utils.aoa_to_sheet([
            ['Name', 'Ticker', 'Identifier', 'Weight'],
            ['Apple Inc.', 'AAPL', '037833100', '6.5'],
            ['Cash USD', 'CASH_USD', '-', '0.1'],
            ['Hyphen only', '-', 'xxx', '0.1'],
            ['Empty ticker', '', 'xxx', '0.1'],
            ['Null ticker', null, 'xxx', '0.1'],
        ])
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Holdings')

        const buffer = xlsx.write(wb, { type: 'buffer' })

        const symbols = adapter.parseExcelBuffer(buffer)

        // Only AAPL survives: the deny-list drops "-", "" and the null cell,
        // the regex drops CASH_USD (underscore is not in [A-Z-]).
        expect(symbols).toEqual(['AAPL'])
    })
})
