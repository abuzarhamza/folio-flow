const fs = require('node:fs')
const path = require('node:path')
const BatchCalculateRSIs = require('./src/application/BatchCalculateRSIs')
const { GeneratePortfolioPlan } = require('./src/application/GeneratePortfolioPlan.js')
const GetStockRSIs = require('./src/application/GetStockRSIs')
const { SearchResults } = require('./src/application/SearchResults')
const {
    FolioFlowError,
    InvalidSymbolError,
    AdapterError,
    MissingHoldingsError,
} = require('./src/errors')

// Re-exported for library consumers; not referenced in this module's body.
const { RateLimitError } = require('./src/errors')
const SPYHoldingsAdapter = require('./src/infrastructure/SPYHoldingsAdapter')
const YahooFinanceAdapter = require('./src/infrastructure/YahooFinanceAdapter')

const VERSION = require('./package.json').version

class FolioFlow {
    constructor(adapters = {}) {
        this.adapters = {
            yahooFinance: adapters.yahooFinance || new YahooFinanceAdapter(),
            spyHoldings: adapters.spyHoldings || new SPYHoldingsAdapter(),
        }
    }

    async getRSI(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            throw new InvalidSymbolError('Invalid symbol: must be a non-empty string')
        }
        const service = new GetStockRSIs(this.adapters.yahooFinance)
        return service.execute(symbol)
    }

    async syncSPYHoldings() {
        try {
            return await this.adapters.spyHoldings.fetchTickers()
        }
        catch (err) {
            throw new AdapterError(`SPY holdings fetch failed: ${err.message}`)
        }
    }

    async runBatchRSIs(tickers) {
        if (!tickers) {
            const snp500Path = path.join(process.cwd(), 'snp500.json')
            if (!fs.existsSync(snp500Path)) {
                throw new MissingHoldingsError('snp500.json not found. Run syncSPYHoldings() first.')
            }
            tickers = JSON.parse(fs.readFileSync(snp500Path, 'utf8'))
        }
        const getService = new GetStockRSIs(this.adapters.yahooFinance)
        const batchService = new BatchCalculateRSIs(getService)
        return batchService.execute(tickers)
    }

    async planPortfolio(rows, options = {}) {
        const getTop20 = options.getTop20 || (() => {
            if (options.top20)
                return options.top20
            const snp500Path = path.join(process.cwd(), 'snp500.json')
            if (!fs.existsSync(snp500Path)) {
                throw new MissingHoldingsError('snp500.json not found. Run syncSPYHoldings() first.')
            }
            const list = JSON.parse(fs.readFileSync(snp500Path, 'utf8'))
            return Array.isArray(list) ? list.slice(0, 20) : []
        })
        const service = new GeneratePortfolioPlan(getTop20)
        return service.execute(rows)
    }

    search(options = {}) {
        const getData = options.getData || (() => {
            const resultsPath = path.join(process.cwd(), 'spy_rsi_results.json')
            if (!fs.existsSync(resultsPath)) {
                throw new FolioFlowError('spy_rsi_results.json not found. Run `folioflow batch-spy` first.')
            }
            const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
            if (!data || typeof data !== 'object' || !Array.isArray(data.tickers)) {
                throw new FolioFlowError('spy_rsi_results.json has an unexpected shape (expected { generated_at, tickers: [...] }).')
            }
            return data
        })
        const service = new SearchResults(getData)
        const tickers = options.symbol
            ? service.findBySymbol(options.symbol)
            : service.topByRsiAvg(options.top ?? 20)
        const data = getData()
        return {
            generated_at: data.generated_at,
            tickers: Array.isArray(tickers) ? tickers : [tickers],
        }
    }
}

FolioFlow.version = VERSION
FolioFlow.FolioFlowError = FolioFlowError
FolioFlow.InvalidSymbolError = InvalidSymbolError
FolioFlow.AdapterError = AdapterError
FolioFlow.MissingHoldingsError = MissingHoldingsError
FolioFlow.RateLimitError = RateLimitError

module.exports = FolioFlow
module.exports.FolioFlow = FolioFlow
module.exports.default = FolioFlow
module.exports.version = VERSION
module.exports.FolioFlowError = FolioFlowError
module.exports.InvalidSymbolError = InvalidSymbolError
module.exports.AdapterError = AdapterError
module.exports.MissingHoldingsError = MissingHoldingsError
module.exports.RateLimitError = RateLimitError

if (require.main === module) {
    require('./bin/folioflow.js')
}
