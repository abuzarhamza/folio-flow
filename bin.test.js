const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
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

function runBin(args) {
    try {
        const stdout = execFileSync(process.execPath, [BIN_JS, ...args], {
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

    it('--help exits 0 and lists all three subcommands (parity with index.js)', () => {
        const result = runBin(['--help'])
        expect(result.code).toBe(0)
        expect(result.stdout).toMatch(/folioflow/)
        expect(result.stdout).toMatch(/rsi <symbol>/)
        expect(result.stdout).toMatch(/sync-spy/)
        expect(result.stdout).toMatch(/batch-spy/)
        expect(result.stdout).toMatch(/dump-rh/)
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
})
