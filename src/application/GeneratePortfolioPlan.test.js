const fs = require('node:fs')
const path = require('node:path')
const { decideSignal, GeneratePortfolioPlan } = require('./GeneratePortfolioPlan')

const EXAMPLE_PORTFOLIO_PATH = path.join(__dirname, '..', '..', 'docs', 'example-portfolio.json')
const CANONICAL_KEYS = ['Name', 'Symbol', 'Shares', 'Price', 'Average cost', 'Total return', 'Equity attribute']
const NUMERIC_KEYS = ['Shares', 'Price', 'Average cost', 'Total return']

describe('dECIDESignal — pure decision rule', () => {
    it('returns hold with "Symbol is missing or invalid" when row.Symbol is missing', () => {
        const result = decideSignal({ 'Total return': 100 }, ['AAPL', 'MSFT'])
        expect(result).toEqual({ signal: 'hold', reason: 'Symbol is missing or invalid' })
    })

    it('returns buy when Symbol is not in the top-20 set', () => {
        const result = decideSignal({ 'Symbol': 'XYZ', 'Total return': 0 }, ['AAPL', 'MSFT'])
        expect(result).toEqual({
            signal: 'buy',
            reason: 'Symbol is not in the S&P 500 top-20 set (consider buying more)',
        })
    })

    it('returns sell when Symbol is in the top-20 set AND Total return is strictly negative', () => {
        const result = decideSignal({ 'Symbol': 'AAPL', 'Total return': -50 }, ['AAPL', 'MSFT'])
        expect(result).toEqual({
            signal: 'sell',
            reason: 'Symbol is in the S&P 500 top-20 set with negative total return (consider selling)',
        })
    })

    it('returns hold when Symbol is in the top-20 set AND Total return is positive', () => {
        const result = decideSignal({ 'Symbol': 'AAPL', 'Total return': 100 }, ['AAPL', 'MSFT'])
        expect(result).toEqual({
            signal: 'hold',
            reason: 'Symbol is in the S&P 500 top-20 set with non-negative total return',
        })
    })

    it('returns hold when Symbol is in the top-20 set AND Total return is zero', () => {
        const result = decideSignal({ 'Symbol': 'AAPL', 'Total return': 0 }, ['AAPL', 'MSFT'])
        expect(result.signal).toBe('hold')
    })

    it('returns hold when Symbol is in the top-20 set AND Total return is non-numeric', () => {
        const result = decideSignal({ 'Symbol': 'AAPL', 'Total return': 'not a number' }, ['AAPL', 'MSFT'])
        expect(result.signal).toBe('hold')
    })
})

describe('gENERATEPortfolioPlan.execute — row preservation', () => {
    it('preserves every input field on every row and attaches signal + reason', async () => {
        const service = new GeneratePortfolioPlan(() => ['AAPL', 'MSFT'])
        const rows = [
            { 'Name': 'Apple Inc.', 'Symbol': 'AAPL', 'Shares': 12, 'Price': 191.05, 'Average cost': 178.42, 'Total return': 151.56, 'Equity attribute': 'stock' },
            { 'Name': 'Microsoft', 'Symbol': 'XYZ', 'Shares': 5, 'Price': 400, 'Average cost': 350, 'Total return': 250, 'Equity attribute': 'stock' },
        ]
        const result = await service.execute(rows)
        expect(result[0]).toEqual({
            'Name': 'Apple Inc.',
            'Symbol': 'AAPL',
            'Shares': 12,
            'Price': 191.05,
            'Average cost': 178.42,
            'Total return': 151.56,
            'Equity attribute': 'stock',
            'signal': 'hold',
            'reason': 'Symbol is in the S&P 500 top-20 set with non-negative total return',
        })
        expect(result[1]).toEqual({
            'Name': 'Microsoft',
            'Symbol': 'XYZ',
            'Shares': 5,
            'Price': 400,
            'Average cost': 350,
            'Total return': 250,
            'Equity attribute': 'stock',
            'signal': 'buy',
            'reason': 'Symbol is not in the S&P 500 top-20 set (consider buying more)',
        })
    })
})

describe('docs/example-portfolio.json — worked-example shape contract', () => {
    let rows

    beforeAll(() => {
        const raw = fs.readFileSync(EXAMPLE_PORTFOLIO_PATH, 'utf8')
        rows = JSON.parse(raw)
    })

    it('parses as a JSON array of length 4', () => {
        expect(Array.isArray(rows)).toBe(true)
        expect(rows.length).toBe(4)
    })

    it('every row contains exactly the 6+1 canonical input keys', () => {
        for (const [, row] of rows.entries()) {
            expect(Object.keys(row).sort()).toEqual([...CANONICAL_KEYS].sort())
        }
    })

    it('every numeric field is a number', () => {
        for (const [, row] of rows.entries()) {
            for (const key of NUMERIC_KEYS) {
                expect(typeof row[key]).toBe('number')
            }
        }
    })

    it('every Symbol is a non-empty string', () => {
        for (const row of rows) {
            expect(typeof row.Symbol).toBe('string')
            expect(row.Symbol.length).toBeGreaterThan(0)
        }
    })

    it('no row contains signal or reason (those are output, not input)', () => {
        for (const row of rows) {
            expect(row).not.toHaveProperty('signal')
            expect(row).not.toHaveProperty('reason')
        }
    })
})
