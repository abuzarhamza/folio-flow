const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { FolioFlowError, RobinhoodAuthError } = require('../errors')

const TOKEN_DIR = path.join(os.homedir(), '.folioflow')
const TOKEN_PATH = path.join(TOKEN_DIR, 'robinhood_device_token')

function readCachedToken() {
    try {
        return fs.readFileSync(TOKEN_PATH, 'utf8').trim()
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return null
        throw new RobinhoodAuthError(`Failed to read device token: ${err.message}`)
    }
}

function writeCachedToken(token) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true })
    fs.writeFileSync(TOKEN_PATH, token, { mode: 0o600 })
    try {
        fs.chmodSync(TOKEN_PATH, 0o600)
    }
    catch {
    // best-effort; Windows ignores chmod
    }
}

function toNumber(value) {
    if (value === null || value === undefined || value === '')
        return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

/**
 * Map a raw Robinhood position to the FolioFlow-owned Position shape.
 * Unknown raw fields are dropped. Missing canonical fields are emitted as null.
 * `unrealised_pl_pct` is computed as a percentage of cost basis (quantity * average_buy_price).
 */
function normalisePosition(raw) {
    if (!raw || typeof raw !== 'object')
        return null
    const quantity = toNumber(raw.quantity)
    const average_buy_price = toNumber(raw.average_buy_price)
    const current_price = toNumber(raw.current_price)
    const market_value = toNumber(raw.market_value)
    const unrealised_pl = toNumber(raw.unrealised_pl)
    const cost_basis = (quantity !== null && average_buy_price !== null) ? quantity * average_buy_price : null
    const unrealised_pl_pct = (unrealised_pl !== null && cost_basis !== null && cost_basis !== 0)
        ? Number(((unrealised_pl / cost_basis) * 100).toFixed(2))
        : null
    return {
        symbol: typeof raw.symbol === 'string' ? raw.symbol : null,
        quantity,
        average_buy_price,
        current_price,
        market_value,
        unrealised_pl,
        unrealised_pl_pct,
    }
}

function normalisePositions(rawPositions) {
    if (!Array.isArray(rawPositions))
        return []
    return rawPositions.map(normalisePosition).filter(p => p && p.symbol)
}

/**
 * Application service: authenticate against Robinhood, persist a device token,
 * fetch the user's positions, and normalise them into the FolioFlow shape.
 */
class DumpRobinhoodPortfolio {
    constructor(adapter, options = {}) {
        this.adapter = adapter
        this.tokenReader = options.tokenReader || readCachedToken
        this.tokenWriter = options.tokenWriter || writeCachedToken
    }

    async execute({ username, password, mfaCode } = {}) {
        let token = this.tokenReader()
        if (!token) {
            if (!username || !password) {
                throw new RobinhoodAuthError('Credentials required for first-run login.')
            }
            try {
                token = await this.adapter.login({ username, password, mfaCode })
            }
            catch (err) {
                if (err instanceof FolioFlowError)
                    throw err
                if (err && err.code === 'MFA_REQUIRED' && !mfaCode) {
                    throw new RobinhoodAuthError('MFA code required.')
                }
                throw new RobinhoodAuthError(`Login failed: ${err && err.message ? err.message : 'unknown error'}`)
            }
            this.tokenWriter(token)
        }
        try {
            const raw = await this.adapter.fetchPositions(token)
            return normalisePositions(raw)
        }
        catch (err) {
            if (err instanceof FolioFlowError)
                throw err
            if (err && (err.code === 'TOKEN_REJECTED' || err.code === 'INVALID_TOKEN' || (err.message && /token/i.test(err.message)))) {
                throw new RobinhoodAuthError('Cached device token was rejected. Re-authentication required.')
            }
            throw new RobinhoodAuthError(`Fetch positions failed: ${err && err.message ? err.message : 'unknown error'}`)
        }
    }
}

module.exports = DumpRobinhoodPortfolio
module.exports.DumpRobinhoodPortfolio = DumpRobinhoodPortfolio
module.exports.TOKEN_PATH = TOKEN_PATH
module.exports.writeCachedToken = writeCachedToken
module.exports.readCachedToken = readCachedToken
module.exports.normalisePosition = normalisePosition
module.exports.normalisePositions = normalisePositions
