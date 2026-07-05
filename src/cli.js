const fs = require('node:fs')
const path = require('node:path')
const debug = require('debug')('folioflow:cli')
const FolioFlow = require('..')
const { FolioFlowError } = require('..')

const PLAN_DISCLAIMER = 'Plan signals are a mechanical rule, not financial advice. Consult a licensed advisor before acting on them.'

function prettyJson(value, argv) {
    const isPretty = (argv && argv.pretty) || process.argv.includes('--pretty')
    return isPretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
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
    console.log(
        prettyJson(
            {
                status: 'success',
                tickersCount: tickers.length,
                file: 'snp500.json',
            },
            argv,
        ),
    )
}

async function runBatchSPY(argv) {
    debug('Initiating batch calculations based on snp500.json')
    if (!fs.existsSync('snp500.json')) {
        console.error(
            require('chalk').yellow(
                'Warning: snp500.json not found. Run `folioflow sync-spy` first.',
            ),
        )
        process.exit(1)
    }
    const symbols = JSON.parse(fs.readFileSync('snp500.json', 'utf8'))
    debug(`Parsed ${symbols.length} symbols targeting batch pipeline`)

    console.log(
        prettyJson(
            {
                status: 'processing',
                message: `Processing ${symbols.length} stocks. This will take approx ${symbols.length} seconds.`,
            },
            argv,
        ),
    )

    const ff = new FolioFlow()
    const results = await ff.runBatchRSIs(symbols)

    fs.writeFileSync('spy_rsi_results.json', JSON.stringify(results, null, 2))
    debug('Results buffer fully dumped to spy_rsi_results.json')
    console.log(
        prettyJson(
            {
                status: 'success',
                count: results.length,
                file: 'spy_rsi_results.json',
            },
            argv,
        ),
    )
}

async function runPlan(argv, options = {}) {
    debug('Initiating portfolio plan')
    const file = argv.file
    if (!file) {
        throw new FolioFlowError('Input file not found: (none provided)')
    }
    const inputPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(inputPath)) {
        throw new FolioFlowError(`Input file not found: ${inputPath}`)
    }
    const raw = fs.readFileSync(inputPath, 'utf8')
    let rows
    try {
        rows = JSON.parse(raw)
    }
    catch {
        throw new FolioFlowError('Input file is not a JSON array.')
    }
    if (!Array.isArray(rows)) {
        throw new FolioFlowError('Input file is not a JSON array.')
    }

    const ff = new FolioFlow()
    const plan = await ff.planPortfolio(rows, options)

    const outPath = path.join(process.cwd(), 'plan.json')
    fs.writeFileSync(outPath, JSON.stringify(plan, null, 2))

    const buy = plan.filter(r => r.signal === 'buy').length
    const sell = plan.filter(r => r.signal === 'sell').length
    const hold = plan.filter(r => r.signal === 'hold').length

    const status = {
        status: 'success',
        rowCount: plan.length,
        signalCounts: { buy, sell, hold },
        file: 'plan.json',
    }
    console.error(require('chalk').yellow(`Warning: ${PLAN_DISCLAIMER}`))
    console.log(prettyJson(status, argv))
    return plan
}

async function run(argv, options = {}) {
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

            case 'plan':
                await runPlan(argv, options)
                break
            default:
                throw new Error('Not yet implemented')
        }
    }
    catch (err) {
        if (err instanceof FolioFlowError) {
            const chalk = require('chalk')
            console.error(chalk.red(`Error: ${err.message}`))
            process.exit(1)
        }
        throw err
    }
}

module.exports = { run, runRSI, runSyncSPY, runBatchSPY, runPlan }
