const fs = require('node:fs')
const path = require('node:path')
const debug = require('debug')('folioflow:cli')
const FolioFlow = require('..')
const { FolioFlowError } = require('..')

function prettyJson(value, argv) {
    const isPretty = (argv && argv.pretty) || process.argv.includes('--pretty')
    return isPretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
}

function createPromptSession(initialLines = null) {
    let lines = initialLines
    let cursor = 0

    async function ensureLines() {
        if (lines !== null)
            return
        const chunks = []
        for await (const chunk of process.stdin) chunks.push(chunk)
        lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(l => l.length > 0)
    }

    return {
        async ask(prompt) {
            process.stderr.write(prompt)
            await ensureLines()
            const value = lines[cursor] || ''
            cursor += 1
            return value
        },
    }
}

async function promptSecret(prompt, options = {}) {
    if (options.session) {
        return options.session.ask(prompt)
    }
    // Fallback: a single-shot session built from stdinLines or stdin itself.
    const session = createPromptSession(options.stdinLines || null)
    return session.ask(prompt)
}

function _resetPromptState() {
    // No-op kept for backwards compatibility with old test calls.
}

async function runRSI(symbol, argv) {
    debug(`Executing direct single-symbol payload for ${symbol}`)
    const ff = new FolioFlow()
    const result = await ff.getRSI(symbol)
    console.log(prettyJson(result, argv))
}

async function runSyncSPY(argv) {
    debug('Initiating S&P 500 JSON sync')
    const ff = new FolioFlow()
    const tickers = await ff.syncSPYHoldings()
    fs.writeFileSync('snp500.json', JSON.stringify(tickers, null, 2))
    debug(`Successfully generated snp500.json with ${tickers.length} tickers`)
    console.log(prettyJson({ status: 'success', tickersCount: tickers.length, file: 'snp500.json' }, argv))
}

async function runBatchSPY(argv) {
    debug('Initiating batch calculations based on snp500.json')
    if (!fs.existsSync('snp500.json')) {
        console.error(require('chalk').yellow('Warning: snp500.json not found. Run `folioflow sync-spy` first.'))
        process.exit(1)
    }
    const symbols = JSON.parse(fs.readFileSync('snp500.json', 'utf8'))
    debug(`Parsed ${symbols.length} symbols targeting batch pipeline`)

    console.log(prettyJson({ status: 'processing', message: `Processing ${symbols.length} stocks. This will take approx ${symbols.length} seconds.` }, argv))

    const ff = new FolioFlow()
    const results = await ff.runBatchRSIs(symbols)

    fs.writeFileSync('spy_rsi_results.json', JSON.stringify(results, null, 2))
    debug('Results buffer fully dumped to spy_rsi_results.json')
    console.log(prettyJson({ status: 'success', count: results.length, file: 'spy_rsi_results.json' }, argv))
}

const ROBINHOOD_PORTFOLIO_FILE = 'robinhood_portfolio.json'

async function fetchPositionsWithRetry(ff, credentials, session) {
    try {
        return await ff.dumpRobinhoodPortfolio(credentials)
    }
    catch (err) {
        if (err instanceof FolioFlowError && err.message === 'MFA code required.') {
            const mfaCode = await session.ask('MFA code: ')
            return ff.dumpRobinhoodPortfolio({ ...credentials, mfaCode })
        }
        throw err
    }
}

async function runDumpRH(argv, options = {}) {
    debug('Initiating Robinhood portfolio dump')
    const ff = new FolioFlow()
    const session = options.session || createPromptSession(options.stdinLines || null)
    let credentials = options.credentials || null
    if (!credentials) {
        const username = await session.ask('Robinhood username: ')
        const password = await session.ask('Robinhood password: ')
        credentials = { username, password }
    }
    const positions = await fetchPositionsWithRetry(ff, credentials, session)
    const asOf = new Date().toISOString()
    const payload = { asOf, positions }
    const dumpPath = path.join(process.cwd(), ROBINHOOD_PORTFOLIO_FILE)
    fs.writeFileSync(dumpPath, JSON.stringify(payload, null, 2))
    debug(`Wrote ${positions.length} positions to ${dumpPath}`)
    const status = { status: 'success', positionsCount: positions.length, file: ROBINHOOD_PORTFOLIO_FILE }
    console.log(prettyJson(status, argv))
    return positions
}

async function run(argv) {
    const command = argv._[0]
    try {
        switch (command) {
            case 'rsi':
                await runRSI(argv.symbol, argv)
                break
            case 'sync-spy':
                await runSyncSPY(argv)
                break
            case 'batch-spy':
                await runBatchSPY(argv)
                break
            case 'dump-rh':
                await runDumpRH(argv)
                break
            default:
                throw new Error('Not yet implemented')
        }
    }
    catch (err) {
        if (err instanceof FolioFlowError) {
            console.error(require('chalk').red(`Error: ${err.message}`))
            process.exit(1)
        }
        throw err
    }
}

module.exports = { run, runRSI, runSyncSPY, runBatchSPY, runDumpRH, promptSecret, createPromptSession, _resetPromptState }
