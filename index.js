const fs = require('node:fs')
const path = require('node:path')
const BatchCalculateRSIs = require('./src/application/BatchCalculateRSIs')
const { GeneratePortfolioPlan } = require('./src/application/GeneratePortfolioPlan.js')
const GetStockRSIs = require('./src/application/GetStockRSIs')
const {
    FolioFlowError,
    InvalidSymbolError,
    AdapterError,
    MissingHoldingsError,
} = require('./src/errors')
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
}

FolioFlow.version = VERSION
FolioFlow.FolioFlowError = FolioFlowError
FolioFlow.InvalidSymbolError = InvalidSymbolError
FolioFlow.AdapterError = AdapterError
FolioFlow.MissingHoldingsError = MissingHoldingsError

module.exports = FolioFlow
module.exports.FolioFlow = FolioFlow
module.exports.default = FolioFlow
module.exports.version = VERSION
module.exports.FolioFlowError = FolioFlowError
module.exports.InvalidSymbolError = InvalidSymbolError
module.exports.AdapterError = AdapterError
module.exports.MissingHoldingsError = MissingHoldingsError

if (require.main === module) {
    require('./bin/folioflow.js')
}
