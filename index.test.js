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

const { execFileSync } = require('node:child_process')

const INDEX_JS = path.join(PROJECT_ROOT, 'index.js')

function runCli(args) {
    try {
        const stdout = execFileSync(process.execPath, [INDEX_JS, ...args], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, FORCE_COLOR: '0' },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { code: 0, stdout, stderr: '' }
    }
    catch (err) {
        return {
            code: err.status ?? 1,
            stdout: err.stdout ? err.stdout.toString() : '',
            stderr: err.stderr ? err.stderr.toString() : '',
        }
    }
}

describe('cLI integration — parsing & error surfaces (spawn index.js)', () => {
    describe('--help', () => {
        it('exits 0 and lists all subcommands', () => {
            const result = runCli(['--help'])
            expect(result.code).toBe(0)
            expect(result.stdout).toMatch(/folioflow/)
            expect(result.stdout).toMatch(/rsi <symbol>/)
            expect(result.stdout).toMatch(/sync-spy/)
            expect(result.stdout).toMatch(/batch-spy/)
        })
    })

    describe('rsi subcommand', () => {
        it('rsi with no symbol exits non-zero and prints an error', () => {
            const result = runCli(['rsi'])
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/Error:/)
        })

        it('legacy bare symbol is rejected by strict mode', () => {
            const result = runCli(['AAPL'])
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/Error:/)
        })
    })

    describe('batch-spy subcommand', () => {
        afterEach(() => {
            if (fs.existsSync(snp500Path))
                fs.unlinkSync(snp500Path)
            if (fs.existsSync(resultsPath))
                fs.unlinkSync(resultsPath)
        })

        it('exits non-zero with a warning when snp500.json is missing', () => {
            if (fs.existsSync(snp500Path))
                fs.unlinkSync(snp500Path)
            const result = runCli(['batch-spy'])
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/Warning: snp500\.json not found/)
        })

        it('rejects extra arguments via strict mode', () => {
            fs.writeFileSync(snp500Path, JSON.stringify(['AAPL']))
            const result = runCli(['batch-spy', 'BOGUS'])
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/Error:/)
        })
    })

    describe('unknown command', () => {
        it('exits non-zero', () => {
            const result = runCli(['definitely-not-a-command'])
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/Error:/)
        })
    })
})

describe('cLI handlers (cli.run) — happy paths via mocked adapters', () => {
    let cli

    beforeAll(() => {
        cli = require('./src/cli')
    })

    beforeEach(() => {
        if (fs.existsSync(snp500Path))
            fs.unlinkSync(snp500Path)
        if (fs.existsSync(resultsPath))
            fs.unlinkSync(resultsPath)
    })

    afterEach(() => {
        if (fs.existsSync(snp500Path))
            fs.unlinkSync(snp500Path)
        if (fs.existsSync(resultsPath))
            fs.unlinkSync(resultsPath)
    })

    it('runRSI emits a JSON payload with the RSI shape', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        await cli.run({ _: ['rsi'], symbol: 'AAPL' })
        expect(logSpy).toHaveBeenCalledTimes(1)
        const parsed = JSON.parse(logSpy.mock.calls[0][0])
        expect(parsed).toHaveProperty('symbol', 'AAPL')
        expect(parsed).toHaveProperty('rsi_22')
        expect(parsed).toHaveProperty('rsi_44')
        expect(parsed).toHaveProperty('rsi_66')
        expect(parsed).toHaveProperty('rsi_avg')
        expect(typeof parsed.rsi_22).toBe('number')
        logSpy.mockRestore()
    })

    it('runSyncSPY writes snp500.json and prints a JSON status', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        await cli.run({ _: ['sync-spy'] })
        expect(fs.existsSync(snp500Path)).toBe(true)
        expect(JSON.parse(fs.readFileSync(snp500Path, 'utf8'))).toEqual(['AAPL', 'MSFT', 'GOOG'])
        const stdoutJson = JSON.parse(logSpy.mock.calls[0][0])
        expect(stdoutJson).toMatchObject({ status: 'success', tickersCount: 3, file: 'snp500.json' })
        logSpy.mockRestore()
    })

    it('runBatchSPY writes spy_rsi_results.json from mocked data', async () => {
        fs.writeFileSync(snp500Path, JSON.stringify(['AAPL', 'MSFT']))
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        await cli.run({ _: ['batch-spy'] })
        expect(fs.existsSync(resultsPath)).toBe(true)
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(2)

        const lastCall = JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0])
        expect(lastCall).toMatchObject({ status: 'success', count: 2, file: 'spy_rsi_results.json' })
        logSpy.mockRestore()
    })
})
