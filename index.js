const fs = require('node:fs')
const path = require('node:path')
const BatchCalculateRSIs = require('./src/application/BatchCalculateRSIs')
const DumpRobinhoodPortfolio = require('./src/application/DumpRobinhoodPortfolio')
const GetStockRSIs = require('./src/application/GetStockRSIs')
const {
    FolioFlowError,
    InvalidSymbolError,
    AdapterError,
    MissingHoldingsError,
    RobinhoodAuthError,
} = require('./src/errors')
const RobinhoodAdapter = require('./src/infrastructure/RobinhoodAdapter')
const SPYHoldingsAdapter = require('./src/infrastructure/SPYHoldingsAdapter')
const YahooFinanceAdapter = require('./src/infrastructure/YahooFinanceAdapter')

const VERSION = require('./package.json').version

class FolioFlow {
    constructor(adapters = {}) {
        this.adapters = {
            yahooFinance: adapters.yahooFinance || new YahooFinanceAdapter(),
            spyHoldings: adapters.spyHoldings || new SPYHoldingsAdapter(),
            robinhood: adapters.robinhood === undefined ? new RobinhoodAdapter() : adapters.robinhood,
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

    async dumpRobinhoodPortfolio(credentials = {}) {
        if (!this.adapters.robinhood) {
            throw new RobinhoodAuthError('Robinhood adapter is not configured.')
        }
        const service = new DumpRobinhoodPortfolio(this.adapters.robinhood)
        return service.execute(credentials)
    }
}

FolioFlow.version = VERSION
FolioFlow.FolioFlowError = FolioFlowError
FolioFlow.InvalidSymbolError = InvalidSymbolError
FolioFlow.AdapterError = AdapterError
FolioFlow.MissingHoldingsError = MissingHoldingsError
FolioFlow.RobinhoodAuthError = RobinhoodAuthError

module.exports = FolioFlow
module.exports.FolioFlow = FolioFlow
module.exports.default = FolioFlow
module.exports.version = VERSION
module.exports.FolioFlowError = FolioFlowError
module.exports.InvalidSymbolError = InvalidSymbolError
module.exports.AdapterError = AdapterError
module.exports.MissingHoldingsError = MissingHoldingsError
module.exports.RobinhoodAuthError = RobinhoodAuthError

if (require.main === module) {
    require('./bin/folioflow.js')
}
