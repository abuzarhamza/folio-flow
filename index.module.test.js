const fs = require('node:fs')
const path = require('node:path')

const PROJECT_ROOT = __dirname
const snp500Path = path.join(PROJECT_ROOT, 'snp500.json')
const resultsPath = path.join(PROJECT_ROOT, 'spy_rsi_results.json')

jest.mock('./src/infrastructure/YahooFinanceAdapter', () => {
    return jest.fn().mockImplementation(() => ({
        getHistoricalPrices: jest.fn().mockResolvedValue(
            Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 5) * 10),
        ),
    }))
})

jest.mock('./src/infrastructure/SPYHoldingsAdapter', () => {
    return jest.fn().mockImplementation(() => ({
        fetchTickers: jest.fn().mockResolvedValue(['AAPL', 'MSFT', 'GOOG']),
    }))
})

describe('folioFlow library entry (index.js) — side-effect-free + public API', () => {
    let stdoutSpy
    let exitSpy
    let logSpy

    beforeEach(() => {
        stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {})
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        if (fs.existsSync(snp500Path))
            fs.unlinkSync(snp500Path)
        if (fs.existsSync(resultsPath))
            fs.unlinkSync(resultsPath)
    })

    afterEach(() => {
        stdoutSpy.mockRestore()
        exitSpy.mockRestore()
        logSpy.mockRestore()
        jest.resetModules()
        if (fs.existsSync(snp500Path))
            fs.unlinkSync(snp500Path)
        if (fs.existsSync(resultsPath))
            fs.unlinkSync(resultsPath)
    })

    it('require() does not write to process.stdout', () => {
        require('./index')
        expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('require() does not call process.exit', () => {
        require('./index')
        expect(exitSpy).not.toHaveBeenCalled()
    })

    it('require() does not call console.log', () => {
        require('./index')
        expect(logSpy).not.toHaveBeenCalled()
    })

    it('exports a FolioFlow class as default and named export', () => {
        const mod = require('./index')
        expect(typeof mod.FolioFlow).toBe('function')
        expect(typeof mod.default).toBe('function')
        expect(mod.default).toBe(mod.FolioFlow)
    })

    it('new FolioFlow() constructs with no arguments', () => {
        const { FolioFlow } = require('./index')
        expect(() => new FolioFlow()).not.toThrow()
    })

    it('folioFlow.prototype exposes a getRSI method', () => {
        const { FolioFlow } = require('./index')
        const ff = new FolioFlow()
        expect(typeof ff.getRSI).toBe('function')
    })

    it('getRSI("AAPL") resolves to the expected RSI payload shape', async () => {
        const { FolioFlow } = require('./index')
        const ff = new FolioFlow()
        const result = await ff.getRSI('AAPL')
        expect(result).toHaveProperty('symbol', 'AAPL')
        expect(result).toHaveProperty('rsi_22')
        expect(result).toHaveProperty('rsi_44')
        expect(result).toHaveProperty('rsi_66')
        expect(result).toHaveProperty('rsi_avg')
        expect(typeof result.rsi_22).toBe('number')
    })

    it('accepts injected adapters (DI)', async () => {
        const { FolioFlow } = require('./index')
        const mockYahoo = {
            getHistoricalPrices: jest.fn().mockResolvedValue(
                Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 5) * 10),
            ),
        }
        const ff = new FolioFlow({ yahooFinance: mockYahoo })
        const result = await ff.getRSI('MSFT')
        expect(mockYahoo.getHistoricalPrices).toHaveBeenCalled()
        expect(result).toHaveProperty('symbol', 'MSFT')
    })

    it('folioFlow.version is a semver string', () => {
        const { FolioFlow, version } = require('./index')
        expect(typeof version).toBe('string')
        expect(version).toMatch(/^\d+\.\d+\.\d+/)
        expect(FolioFlow.version).toBe(version)
    })

    it('exports error subclasses', () => {
        const mod = require('./index')
        expect(typeof mod.FolioFlowError).toBe('function')
        expect(typeof mod.InvalidSymbolError).toBe('function')
        expect(typeof mod.AdapterError).toBe('function')
        expect(typeof mod.MissingHoldingsError).toBe('function')
        const e = new mod.InvalidSymbolError('boom')
        expect(e).toBeInstanceOf(Error)
        expect(e).toBeInstanceOf(mod.FolioFlowError)
    })

    it('getRSI("") rejects with InvalidSymbolError', async () => {
        const { FolioFlow, InvalidSymbolError } = require('./index')
        const ff = new FolioFlow()
        await expect(ff.getRSI('')).rejects.toBeInstanceOf(InvalidSymbolError)
    })

    it('syncSPYHoldings() resolves to an array of tickers', async () => {
        const { FolioFlow } = require('./index')
        const ff = new FolioFlow()
        const tickers = await ff.syncSPYHoldings()
        expect(Array.isArray(tickers)).toBe(true)
        expect(tickers).toEqual(['AAPL', 'MSFT', 'GOOG'])
    })

    it('runBatchRSIs(tickers) resolves to the batch payload', async () => {
        const { FolioFlow } = require('./index')
        const ff = new FolioFlow()
        const results = await ff.runBatchRSIs(['AAPL', 'MSFT'])
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(2)
        expect(results[0]).toHaveProperty('symbol')
    })

    it('runBatchRSIs() with no tickers and no snp500.json rejects with MissingHoldingsError', async () => {
        const { FolioFlow, MissingHoldingsError } = require('./index')
        const ff = new FolioFlow()
        if (fs.existsSync(snp500Path))
            fs.unlinkSync(snp500Path)
        await expect(ff.runBatchRSIs()).rejects.toBeInstanceOf(MissingHoldingsError)
    })

    it('syncSPYHoldings() wraps adapter errors as AdapterError', async () => {
        const { FolioFlow, AdapterError } = require('./index')
        const ff = new FolioFlow({
            spyHoldings: { fetchTickers: jest.fn().mockRejectedValue(new Error('boom')) },
        })
        await expect(ff.syncSPYHoldings()).rejects.toBeInstanceOf(AdapterError)
    })

    it('folioFlow.planPortfolio(rows, options) returns the augmented array with signal + reason', async () => {
        jest.isolateModules(() => {
            const { FolioFlow } = require('./index')
            const ff = new FolioFlow()
            const rows = [
                { 'Name': 'Apple', 'Symbol': 'AAPL', 'Shares': 12, 'Price': 191, 'Average cost': 178, 'Total return': 150, 'Equity attribute': 'stock' },
                { 'Name': 'Unknown', 'Symbol': 'XYZ', 'Shares': 1, 'Price': 50, 'Average cost': 40, 'Total return': 10, 'Equity attribute': 'stock' },
            ]
            return ff.planPortfolio(rows, { top20: ['AAPL', 'MSFT'] }).then((result) => {
                expect(result[0].signal).toBe('hold')
                expect(result[0].reason).toMatch(/non-negative/)
                expect(result[1].signal).toBe('buy')
                expect(result[0].Name).toBe('Apple')
                expect(result[0]['Equity attribute']).toBe('stock')
            })
        })
    })

    it('folioFlow.planPortfolio(rows) throws MissingHoldingsError when snp500.json is absent', async () => {
        jest.isolateModules(() => {
            const { FolioFlow, MissingHoldingsError } = require('./index')
            const ff = new FolioFlow()
            if (fs.existsSync(snp500Path))
                fs.unlinkSync(snp500Path)

            expect(() => ff.planPortfolio([])).rejects.toBeInstanceOf(MissingHoldingsError)
        })
    })
})

describe('src/cli.js — consumes FolioFlow (shared wiring)', () => {
    let logSpy

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
        logSpy.mockRestore()
        jest.resetModules()
    })

    it('does not require infrastructure adapters directly', () => {
        const cliSource = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'cli.js'), 'utf8')
        expect(cliSource).not.toMatch(/require\(['"]\.\/infrastructure\//)
    })

    it('delegates to the FolioFlow class for rsi', async () => {
        const cli = require('./src/cli')
        await cli.run({ _: ['rsi'], symbol: 'AAPL' })
        expect(logSpy).toHaveBeenCalledTimes(1)
        const parsed = JSON.parse(logSpy.mock.calls[0][0])
        expect(parsed).toHaveProperty('symbol', 'AAPL')
    })
})
