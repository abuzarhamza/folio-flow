const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PROJECT_ROOT = __dirname
const BIN_JS = path.join(PROJECT_ROOT, 'bin', 'folioflow.js')

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
})
