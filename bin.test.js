const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PROJECT_ROOT = __dirname
const BIN_JS = path.join(PROJECT_ROOT, 'bin', 'folioflow.js')

jest.mock('./src/infrastructure/YahooFinanceAdapter', () => {
    const base = new Date('2025-01-01').getTime()
    const oneDay = 24 * 60 * 60 * 1000
    return jest.fn().mockImplementation(() => ({
        getHistoricalPrices: jest.fn().mockResolvedValue(
            Array.from({ length: 200 }, (_, i) => ({
                date: new Date(base + i * oneDay).toISOString().split('T')[0],
                close: 100 + Math.sin(i / 5) * 10,
            })),
        ),
    }))
})

jest.mock('./src/infrastructure/SPYHoldingsAdapter', () => {
    return jest.fn().mockImplementation(() => ({
        fetchTickers: jest.fn().mockResolvedValue(['AAPL', 'MSFT', 'GOOG']),
    }))
})

function runBin(args, cwd = PROJECT_ROOT) {
    const result = spawnSync(process.execPath, [BIN_JS, ...args], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    return {
        code: result.status ?? 0,
        stdout: result.stdout ? result.stdout.toString() : '',
        stderr: result.stderr ? result.stderr.toString() : '',
    }
}

describe('bin/folioflow.js shim — parity with index.js', () => {
    it('exists and is executable', () => {
        expect(fs.existsSync(BIN_JS)).toBe(true)
        const stat = fs.statSync(BIN_JS)
        // owner-execute bit set
        expect(stat.mode & 0o100).toBeGreaterThan(0)
    })

    it('has a node shebang on line 1', () => {
        const firstLine = fs.readFileSync(BIN_JS, 'utf8').split('\n')[0]
        expect(firstLine).toMatch(/^#!\s*\/usr\/bin\/env\s+node/)
    })

    it('--help exits 0 and lists all subcommands (parity with index.js)', () => {
        const result = runBin(['--help'])
        expect(result.code).toBe(0)
        expect(result.stdout).toMatch(/folioflow/)
        expect(result.stdout).toMatch(/rsi <symbol>/)
        expect(result.stdout).toMatch(/sync-spy/)
        expect(result.stdout).toMatch(/batch-spy/)
        expect(result.stdout).toMatch(/plan <file>/)
        expect(result.stdout).toMatch(/search/)
    })

    it('rsi with no symbol exits non-zero and prints an error', () => {
        const result = runBin(['rsi'])
        expect(result.code).not.toBe(0)
        expect(result.stderr).toMatch(/Error:/)
    })

    it('legacy bare symbol is rejected by strict mode', () => {
        const result = runBin(['AAPL'])
        expect(result.code).not.toBe(0)
        expect(result.stderr).toMatch(/Error:/)
    })

    it('unknown command exits non-zero', () => {
        const result = runBin(['definitely-not-a-command'])
        expect(result.code).not.toBe(0)
        expect(result.stderr).toMatch(/Error:/)
    })

    it('plan missing file exits non-zero and prints Error', () => {
        const result = runBin(['plan', 'nonexistent.json'])
        expect(result.code).not.toBe(0)
        expect(result.stderr).toMatch(/Error: Input file not found:/)
    })

    it('plan with no file argument prints a FolioFlow error pointing at the worked example', () => {
        const result = runBin(['plan'])
        expect(result.code).not.toBe(0)
        expect(result.stderr).toMatch(/requires a <file> argument/)
        expect(result.stderr).toMatch(/docs\/example-portfolio\.json/)
    })

    it('rsi with no symbol still shows the yargs default error (not the plan-only substitution)', () => {
        const result = runBin(['rsi'])
        expect(result.code).not.toBe(0)
        expect(result.stderr).toMatch(/Not enough non-option arguments/)
    })

    it('plan valid-but-empty-array succeeds', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const emptyPath = path.join(tmpDir, 'valid-but-empty-array.json')
        const dummySnp500 = path.join(tmpDir, 'snp500.json')
        fs.writeFileSync(emptyPath, '[]')
        fs.writeFileSync(dummySnp500, '["AAPL", "MSFT"]')
        const result = runBin(['plan', 'valid-but-empty-array.json'], tmpDir)
        try {
            if (result.code !== 0)
                console.error(result.stderr)
            expect(result.code).toBe(0)
            const stdoutJson = JSON.parse(result.stdout)
            expect(stdoutJson).toMatchObject({
                status: 'success',
                rowCount: 0,
                signalCounts: { buy: 0, sell: 0, hold: 0 },
            })
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('plan emits a "not investment advice" disclaimer on stderr', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const emptyPath = path.join(tmpDir, 'valid-but-empty-array.json')
        const dummySnp500 = path.join(tmpDir, 'snp500.json')
        fs.writeFileSync(emptyPath, '[]')
        fs.writeFileSync(dummySnp500, '["AAPL", "MSFT"]')
        const result = runBin(['plan', 'valid-but-empty-array.json'], tmpDir)
        try {
            expect(result.code).toBe(0)
            expect(result.stderr).toMatch(/not financial advice/)
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('batch-spy emits per-ticker trace on stderr and a single success line on stdout', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const dummySnp500 = path.join(tmpDir, 'snp500.json')
        fs.writeFileSync(dummySnp500, '["AAPL", "MSFT"]')
        const result = runBin(['batch-spy'], tmpDir)
        try {
            expect(result.code).toBe(0)
            expect(result.stderr).toMatch(/\(1\/2\) AAPL → /)
            expect(result.stderr).toMatch(/\(2\/2\) MSFT → /)
            // Stdout is exactly one JSON line — no "Processing N stocks" pre-run hint.
            expect(result.stdout.trim()).toBe('{"status":"success","count":2,"file":"spy_rsi_results.json"}')
            const resultsPath = path.join(tmpDir, 'spy_rsi_results.json')
            expect(fs.existsSync(resultsPath)).toBe(true)
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
            expect(Array.isArray(results.tickers)).toBe(true)
            expect(results.tickers.length).toBe(2)
            expect(new Date(results.generated_at).toString()).not.toBe('Invalid Date')
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('batch-spy generated_at is close to the current time', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const dummySnp500 = path.join(tmpDir, 'snp500.json')
        fs.writeFileSync(dummySnp500, '["AAPL"]')
        const before = Date.now()
        const result = runBin(['batch-spy'], tmpDir)
        try {
            expect(result.code).toBe(0)
            const after = Date.now()
            const results = JSON.parse(fs.readFileSync(path.join(tmpDir, 'spy_rsi_results.json'), 'utf8'))
            const generatedAt = new Date(results.generated_at).getTime()
            // The timestamp must fall within the run window — not in the past, not in the future.
            expect(generatedAt).toBeGreaterThanOrEqual(before)
            expect(generatedAt).toBeLessThanOrEqual(after)
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    function writeSearchFixture(tmpDir) {
        const fixture = {
            generated_at: '2026-07-05T14:23:45.678Z',
            tickers: [
                { symbol: 'AAPL', rsi_22: 53.82, rsi_44: 55.67, rsi_66: 55.95, rsi_avg: 55.15 },
                { symbol: 'MSFT', rsi_22: 64.03, rsi_44: 57.49, rsi_66: 56.06, rsi_avg: 59.19 },
                { symbol: 'GOOGL', rsi_22: 70.00, rsi_44: 71.00, rsi_66: 72.00, rsi_avg: 71.00 },
            ],
        }
        fs.writeFileSync(path.join(tmpDir, 'spy_rsi_results.json'), JSON.stringify(fixture, null, 2))
        return fixture
    }

    it('search <symbol> returns the matching row with the wrapped { generated_at, tickers } shape', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const fixture = writeSearchFixture(tmpDir)
        const result = runBin(['search', 'AAPL'], tmpDir)
        try {
            expect(result.code).toBe(0)
            const output = JSON.parse(result.stdout)
            expect(output.generated_at).toBe(fixture.generated_at)
            expect(output.tickers).toEqual([fixture.tickers[0]])
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('search --top N returns the first N rows with the wrapped shape', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const fixture = writeSearchFixture(tmpDir)
        const result = runBin(['search', '--top', '2'], tmpDir)
        try {
            expect(result.code).toBe(0)
            const output = JSON.parse(result.stdout)
            expect(output.generated_at).toBe(fixture.generated_at)
            expect(output.tickers).toEqual([fixture.tickers[0], fixture.tickers[1]])
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('search with no args exits non-zero with a usage error', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        writeSearchFixture(tmpDir)
        const result = runBin(['search'], tmpDir)
        try {
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/requires a <symbol> argument or the --top flag/)
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('search for a missing symbol exits non-zero with a "not found" error', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        writeSearchFixture(tmpDir)
        const result = runBin(['search', 'ZZZZ'], tmpDir)
        try {
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/Symbol ZZZZ not found/)
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('search with missing spy_rsi_results.json exits non-zero with a file-missing error', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        const result = runBin(['search', 'AAPL'], tmpDir)
        try {
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/spy_rsi_results\.json not found/)
            expect(result.stderr).toMatch(/batch-spy/)
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('search AAPL --top 2 (mutually exclusive) exits non-zero', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folioflow-test-'))
        writeSearchFixture(tmpDir)
        const result = runBin(['search', 'AAPL', '--top', '2'], tmpDir)
        try {
            expect(result.code).not.toBe(0)
            expect(result.stderr).toMatch(/mutually exclusive/)
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })
})
