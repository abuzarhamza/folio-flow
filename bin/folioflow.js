#!/usr/bin/env node
const debug = require('debug')('folioflow:cli')
const chalk = require('chalk')
const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const cli = require('../src/cli')

const epilogue = chalk.dim('FolioFlow — momentum-based portfolio analysis.')

const parser = yargs(hideBin(process.argv))
    .scriptName('folioflow')
    .usage('$0 [command]')
    .command(
        'rsi <symbol>',
        chalk.cyan('Calculate RSI (22, 44, 66) for a single stock symbol.'),
        y => y.positional('symbol', {
            type: 'string',
            describe: 'Stock ticker symbol (e.g. AAPL)',
        }),
    )
    .command(
        'sync-spy',
        chalk.cyan('Download the latest S&P 500 constituent list to snp500.json.'),
    )
    .command(
        'batch-spy',
        chalk.cyan('Calculate RSI for every ticker in snp500.json → spy_rsi_results.json.'),
    )
    .command(
        'plan <file>',
        chalk.cyan('Generate a portfolio plan from a JSON input file. See docs/example-portfolio.json for a worked example.'),
        y => y.positional('file', {
            type: 'string',
            describe: 'Path to a Trader Portfolio JSON file',
        }),
    )
    .demandCommand(1, chalk.red('Error: a subcommand is required.'))
    .option('pretty', {
        type: 'boolean',
        description: 'Pretty-print JSON output with indentation',
    })
    .strict()
    .recommendCommands()
    .help()
    .alias('help', 'h')
    .version(false)
    .epilogue(epilogue)
    .fail((msg, err) => {
        if (err) {
            console.error(chalk.red(`Error: ${err.message}`))
        }
        else if (msg) {
            console.error(chalk.red(msg.startsWith('Error:') ? msg : `Error: ${msg}`))
        }
        process.exit(1)
    })

async function main() {
    const argv = await parser.parseAsync()
    if (argv._.length === 0)
        return
    try {
        await cli.run(argv)
    }
    catch (error) {
        debug(`CLI caught fatal exception: ${error.message}`)
        console.error(chalk.red(`Error: ${error.message}`))
        process.exit(1)
    }
}

main().catch((err) => {
    console.error(chalk.red(`Error: ${err.message}`))
    process.exit(1)
})
