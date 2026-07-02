const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PROJECT_ROOT = __dirname
const snp500Path = path.join(PROJECT_ROOT, 'snp500.json')
const resultsPath = path.join(PROJECT_ROOT, 'spy_rsi_results.json')
const rhTokenPath = path.join(os.homedir(), '.folioflow', 'robinhood_device_token')

function cleanRobinhoodToken() {
    try {
        fs.unlinkSync(rhTokenPath)
    }
    catch (err) {
        if (err.code !== 'ENOENT')
            throw err
    }
}

// Mock the Robinhood adapter so in-process tests can inject canned behavior.
jest.mock('./src/infrastructure/RobinhoodAdapter', () => {
    return jest.fn().mockImplementation(() => ({
        login: jest.fn().mockResolvedValue('MOCK-TOKEN-FROM-AUTOMOCK'),
        fetchPositions: jest.fn().mockResolvedValue([]),
    }))
})

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
        cleanRobinhoodToken()
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
        cleanRobinhoodToken()
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

    it('exports the RobinhoodAuthError subclass as a FolioFlowError', () => {
        const mod = require('./index')
        expect(typeof mod.RobinhoodAuthError).toBe('function')
        const e = new mod.RobinhoodAuthError('boom')
        expect(e).toBeInstanceOf(Error)
        expect(e).toBeInstanceOf(mod.FolioFlowError)
        expect(e.name).toBe('RobinhoodAuthError')
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

    it('folioFlow.prototype exposes a dumpRobinhoodPortfolio method', () => {
        const { FolioFlow } = require('./index')
        const ff = new FolioFlow()
        expect(typeof ff.dumpRobinhoodPortfolio).toBe('function')
    })

    it('dumpRobinhoodPortfolio() rejects with RobinhoodAuthError when no adapter is wired', async () => {
        const { FolioFlow, RobinhoodAuthError } = require('./index')
        const ff = new FolioFlow({ robinhood: null })
        await expect(ff.dumpRobinhoodPortfolio({ username: 'u', password: 'p' })).rejects.toBeInstanceOf(RobinhoodAuthError)
    })

    it('dumpRobinhoodPortfolio() with a wired adapter calls adapter.login with the supplied credentials', async () => {
        const { FolioFlow } = require('./index')
        const login = jest.fn().mockResolvedValue('TOKEN-XYZ')
        const fetchPositions = jest.fn().mockResolvedValue([])
        const ff = new FolioFlow({ robinhood: { login, fetchPositions } })
        const result = await ff.dumpRobinhoodPortfolio({ username: 'alice', password: 'pw' })
        expect(login).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice', password: 'pw' }))
        expect(result).toEqual([])
    })

    it('dumpRobinhoodPortfolio() reuses a cached device token and skips login', async () => {
        const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
        const login = jest.fn().mockResolvedValue('SHOULD-NOT-BE-USED')
        const fetchPositions = jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: '1' }])
        const tokenReader = jest.fn().mockReturnValue('CACHED-TOKEN')
        const tokenWriter = jest.fn()
        const adapter = { login, fetchPositions }
        const service = new DumpRobinhoodPortfolio(adapter, { tokenReader, tokenWriter })
        const result = await service.execute({ username: 'u', password: 'p' })
        expect(tokenReader).toHaveBeenCalled()
        expect(login).not.toHaveBeenCalled()
        expect(tokenWriter).not.toHaveBeenCalled()
        expect(fetchPositions).toHaveBeenCalledWith('CACHED-TOKEN')
        expect(result).toEqual([{ symbol: 'AAPL', quantity: 1, average_buy_price: null, current_price: null, market_value: null, unrealised_pl: null, unrealised_pl_pct: null }])
    })

    it('dumpRobinhoodPortfolio() with a rejected cached token rejects with RobinhoodAuthError and does not delete the token', async () => {
        const { RobinhoodAuthError } = require('./index')
        const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
        const login = jest.fn().mockResolvedValue('NEW-TOKEN')
        const fetchPositions = jest.fn().mockRejectedValue(Object.assign(new Error('Invalid token.'), { code: 'TOKEN_REJECTED' }))
        const tokenReader = jest.fn().mockReturnValue('STALE-TOKEN')
        const tokenWriter = jest.fn()
        const adapter = { login, fetchPositions }
        const service = new DumpRobinhoodPortfolio(adapter, { tokenReader, tokenWriter })
        await expect(service.execute({ username: 'u', password: 'p' })).rejects.toBeInstanceOf(RobinhoodAuthError)
        expect(tokenWriter).not.toHaveBeenCalled()
    })

    it('writes the device token to disk at ~/.folioflow/robinhood_device_token with 0600 permissions (POSIX)', async () => {
        const { writeCachedToken } = require('./src/application/DumpRobinhoodPortfolio')
        // Direct write via the production helper to assert file shape + permissions.
        writeCachedToken('REAL-TOKEN-XYZ')
        expect(fs.existsSync(rhTokenPath)).toBe(true)
        expect(fs.readFileSync(rhTokenPath, 'utf8').trim()).toBe('REAL-TOKEN-XYZ')
        if (process.platform !== 'win32') {
            const stat = fs.statSync(rhTokenPath)
            // mask with 0o777 to ignore setuid/setgid/sticky bits which we don't touch
            expect(stat.mode & 0o777).toBe(0o600)
        }
    })

    it('dumpRobinhoodPortfolio() surfaces MFA_REQUIRED as RobinhoodAuthError when no mfaCode is supplied', async () => {
        const { RobinhoodAuthError } = require('./index')
        const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
        const login = jest.fn().mockRejectedValue(Object.assign(new Error('mfa required'), { code: 'MFA_REQUIRED' }))
        const fetchPositions = jest.fn()
        const tokenReader = jest.fn().mockReturnValue(null)
        const tokenWriter = jest.fn()
        const adapter = { login, fetchPositions }
        const service = new DumpRobinhoodPortfolio(adapter, { tokenReader, tokenWriter })
        await expect(service.execute({ username: 'u', password: 'p' })).rejects.toBeInstanceOf(RobinhoodAuthError)
        expect(tokenWriter).not.toHaveBeenCalled()
    })

    it('dumpRobinhoodPortfolio() retries login with the mfaCode when supplied', async () => {
        const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
        const login = jest.fn().mockResolvedValue('TOKEN-AFTER-MFA')
        const fetchPositions = jest.fn().mockResolvedValue([])
        const tokenReader = jest.fn().mockReturnValue(null)
        const tokenWriter = jest.fn()
        const adapter = { login, fetchPositions }
        const service = new DumpRobinhoodPortfolio(adapter, { tokenReader, tokenWriter })
        await service.execute({ username: 'u', password: 'p', mfaCode: '123456' })
        expect(login).toHaveBeenCalledWith(expect.objectContaining({ username: 'u', password: 'p', mfaCode: '123456' }))
        expect(tokenWriter).toHaveBeenCalledWith('TOKEN-AFTER-MFA')
    })

    it('src/cli.js exposes a promptSecret helper that consumes lines from a queue', async () => {
        const cli = require('./src/cli')
        expect(typeof cli.promptSecret).toBe('function')
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
        try {
            // Build a session that consumes from a canned line queue
            const session = cli.createPromptSession(['alice', 'hunter2'])
            const a = await cli.promptSecret('Username: ', { session })
            const b = await cli.promptSecret('Password: ', { session })
            expect(a).toBe('alice')
            expect(b).toBe('hunter2')
        }
        finally {
            stderrSpy.mockRestore()
        }
    })

    it('runDumpRH with injected credentials calls adapter.login and writes the token to disk', async () => {
        const cli = require('./src/cli')
        const RobinhoodAdapter = require('./src/infrastructure/RobinhoodAdapter')
        const login = jest.fn().mockResolvedValue('DISK-TOKEN')
        const fetchPositions = jest.fn().mockResolvedValue([])
        RobinhoodAdapter.mockImplementation(() => ({ login, fetchPositions }))
        const session = cli.createPromptSession([])
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            await cli.runDumpRH({ _: ['dump-rh'] }, { credentials: { username: 'u', password: 'p' }, session })
            expect(login).toHaveBeenCalledWith(expect.objectContaining({ username: 'u', password: 'p' }))
            expect(fs.existsSync(rhTokenPath)).toBe(true)
            expect(fs.readFileSync(rhTokenPath, 'utf8').trim()).toBe('DISK-TOKEN')
        }
        finally {
            stderrSpy.mockRestore()
            logSpy.mockRestore()
        }
    })

    it('runDumpRH on an MFA challenge prompts for the code and retries login', async () => {
        const cli = require('./src/cli')
        const RobinhoodAdapter = require('./src/infrastructure/RobinhoodAdapter')
        const login = jest.fn()
            .mockRejectedValueOnce(Object.assign(new Error('mfa'), { code: 'MFA_REQUIRED' }))
            .mockResolvedValueOnce('POST-MFA-TOKEN')
        const fetchPositions = jest.fn().mockResolvedValue([])
        RobinhoodAdapter.mockImplementation(() => ({ login, fetchPositions }))
        const session = cli.createPromptSession(['123456'])
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            await cli.runDumpRH({ _: ['dump-rh'] }, { credentials: { username: 'u', password: 'p' }, session })
            expect(login).toHaveBeenCalledTimes(2)
            expect(login.mock.calls[1][0]).toEqual(expect.objectContaining({ mfaCode: '123456' }))
            expect(fs.readFileSync(rhTokenPath, 'utf8').trim()).toBe('POST-MFA-TOKEN')
        }
        finally {
            stderrSpy.mockRestore()
            logSpy.mockRestore()
        }
    })

    it('dumpRobinhoodPortfolio() normalises the raw Robinhood positions into the canonical Position shape', async () => {
        const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
        const rawPositions = [
            {
                instrument: 'https://api.robinhood.com/instruments/abc/',
                symbol: 'AAPL',
                quantity: '12.0000',
                average_buy_price: '178.4200',
                current_price: '191.0500',
                market_value: '2292.6000',
                unrealised_pl: '151.5600',
            },
        ]
        const login = jest.fn().mockResolvedValue('TOK')
        const fetchPositions = jest.fn().mockResolvedValue(rawPositions)
        const tokenReader = jest.fn().mockReturnValue('TOK')
        const tokenWriter = jest.fn()
        const service = new DumpRobinhoodPortfolio({ login, fetchPositions }, { tokenReader, tokenWriter })
        const result = await service.execute({ username: 'u', password: 'p' })
        // Cost basis: 12 * 178.42 = 2141.04. 151.56 / 2141.04 * 100 = 7.079... ≈ 7.08.
        expect(result).toEqual([{
            symbol: 'AAPL',
            quantity: 12,
            average_buy_price: 178.42,
            current_price: 191.05,
            market_value: 2292.60,
            unrealised_pl: 151.56,
            unrealised_pl_pct: 7.08,
        }])
    })

    it('dumpRobinhoodPortfolio() emits null for missing canonical fields and drops unexpected raw fields', async () => {
        const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
        const rawPositions = [
            {
                symbol: 'TSLA',
                quantity: '5',
                average_buy_price: null,
                current_price: '200.00',
                market_value: '1000.00',
                unrealised_pl: '50.00',
                // some unexpected field Robinhood might add
                secret_internal_flag: 'do-not-leak',
                created_at: '2026-01-01',
            },
        ]
        const fetchPositions = jest.fn().mockResolvedValue(rawPositions)
        const tokenReader = jest.fn().mockReturnValue('TOK')
        const service = new DumpRobinhoodPortfolio({ login: jest.fn(), fetchPositions }, { tokenReader, tokenWriter: jest.fn() })
        const result = await service.execute({ username: 'u', password: 'p' })
        // Exactly 7 keys, no extras, no missing
        expect(Object.keys(result[0]).sort()).toEqual([
            'average_buy_price',
            'current_price',
            'market_value',
            'quantity',
            'symbol',
            'unrealised_pl',
            'unrealised_pl_pct',
        ])
        // Missing field becomes null
        expect(result[0].average_buy_price).toBeNull()
        // Unexpected fields are not echoed
        expect(result[0]).not.toHaveProperty('secret_internal_flag')
        expect(result[0]).not.toHaveProperty('created_at')
    })

    it('runDumpRH returns the positions array to the caller (does not print the array directly to stdout)', async () => {
        const cli = require('./src/cli')
        const RobinhoodAdapter = require('./src/infrastructure/RobinhoodAdapter')
        const dumpPath = path.join(PROJECT_ROOT, 'robinhood_portfolio.json')
        if (fs.existsSync(dumpPath))
            fs.unlinkSync(dumpPath)
        const fetchPositions = jest.fn().mockResolvedValue([
            { symbol: 'AAPL', quantity: '12', average_buy_price: '178.42', current_price: '191.05', market_value: '2292.60', unrealised_pl: '151.56' },
        ])
        RobinhoodAdapter.mockImplementation(() => ({ login: jest.fn().mockResolvedValue('TOK'), fetchPositions }))
        const session = cli.createPromptSession([])
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            const returned = await cli.runDumpRH({ _: ['dump-rh'] }, { credentials: { username: 'u', password: 'p' }, session })
            expect(Array.isArray(returned)).toBe(true)
            expect(returned[0]).toMatchObject({ symbol: 'AAPL', quantity: 12, average_buy_price: 178.42 })
            // The printed line is the status object, not the array
            const stdoutJson = JSON.parse(logSpy.mock.calls[0][0])
            expect(stdoutJson).toMatchObject({ status: 'success', positionsCount: 1 })
        }
        finally {
            stderrSpy.mockRestore()
            logSpy.mockRestore()
            if (fs.existsSync(dumpPath))
                fs.unlinkSync(dumpPath)
        }
    })

    it('runDumpRH writes robinhood_portfolio.json to the CWD and emits the success status on stdout', async () => {
        const cli = require('./src/cli')
        const RobinhoodAdapter = require('./src/infrastructure/RobinhoodAdapter')
        const dumpPath = path.join(PROJECT_ROOT, 'robinhood_portfolio.json')
        if (fs.existsSync(dumpPath))
            fs.unlinkSync(dumpPath)
        const fetchPositions = jest.fn().mockResolvedValue([
            { symbol: 'AAPL', quantity: '1' },
            { symbol: 'MSFT', quantity: '2' },
        ])
        RobinhoodAdapter.mockImplementation(() => ({ login: jest.fn().mockResolvedValue('TOK'), fetchPositions }))
        const session = cli.createPromptSession([])
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            await cli.runDumpRH({ _: ['dump-rh'] }, { credentials: { username: 'u', password: 'p' }, session })
            expect(logSpy).toHaveBeenCalledTimes(1)
            const status = JSON.parse(logSpy.mock.calls[0][0])
            expect(status).toMatchObject({ status: 'success', positionsCount: 2, file: 'robinhood_portfolio.json' })
            expect(fs.existsSync(dumpPath)).toBe(true)
            const fileContents = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
            expect(fileContents).toHaveProperty('asOf')
            expect(typeof fileContents.asOf).toBe('string')
            expect(new Date(fileContents.asOf).toString()).not.toBe('Invalid Date')
            expect(Array.isArray(fileContents.positions)).toBe(true)
            expect(fileContents.positions.length).toBe(2)
            expect(fileContents.positions[0]).toMatchObject({ symbol: 'AAPL', quantity: 1 })
        }
        finally {
            stderrSpy.mockRestore()
            logSpy.mockRestore()
            if (fs.existsSync(dumpPath))
                fs.unlinkSync(dumpPath)
        }
    })

    it('folioFlow.dumpRobinhoodPortfolio() never writes a file to disk', async () => {
        const { FolioFlow } = require('./index')
        const dumpPath = path.join(PROJECT_ROOT, 'robinhood_portfolio.json')
        if (fs.existsSync(dumpPath))
            fs.unlinkSync(dumpPath)
        const ff = new FolioFlow({
            robinhood: {
                login: jest.fn().mockResolvedValue('TOK'),
                fetchPositions: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: '1' }]),
            },
        })
        const result = await ff.dumpRobinhoodPortfolio({ username: 'u', password: 'p' })
        expect(Array.isArray(result)).toBe(true)
        expect(fs.existsSync(dumpPath)).toBe(false)
    })

    it('runDumpRH replaces robinhood_portfolio.json on every run (no merge)', async () => {
        const cli = require('./src/cli')
        const RobinhoodAdapter = require('./src/infrastructure/RobinhoodAdapter')
        const dumpPath = path.join(PROJECT_ROOT, 'robinhood_portfolio.json')
        if (fs.existsSync(dumpPath))
            fs.unlinkSync(dumpPath)
        const fetchPositions = jest.fn()
            .mockResolvedValueOnce([{ symbol: 'AAPL', quantity: '1' }])
            .mockResolvedValueOnce([{ symbol: 'MSFT', quantity: '2' }, { symbol: 'GOOG', quantity: '3' }])
        RobinhoodAdapter.mockImplementation(() => ({ login: jest.fn().mockResolvedValue('TOK'), fetchPositions }))
        const session = cli.createPromptSession([])
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            await cli.runDumpRH({ _: ['dump-rh'] }, { credentials: { username: 'u', password: 'p' }, session })
            const first = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
            expect(first.positions.map(p => p.symbol)).toEqual(['AAPL'])
            await cli.runDumpRH({ _: ['dump-rh'] }, { credentials: { username: 'u', password: 'p' }, session })
            const second = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
            expect(second.positions.map(p => p.symbol).sort()).toEqual(['GOOG', 'MSFT'])
            // AAPL must NOT be in the second run's file
            expect(second.positions.map(p => p.symbol)).not.toContain('AAPL')
        }
        finally {
            stderrSpy.mockRestore()
            logSpy.mockRestore()
            if (fs.existsSync(dumpPath))
                fs.unlinkSync(dumpPath)
        }
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
