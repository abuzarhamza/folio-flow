function isInTop20(symbol, top20Set) {
    return Array.isArray(top20Set) && top20Set.includes(symbol)
}

function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value
    if (typeof value === 'string') {
        const n = Number(value)
        if (Number.isFinite(n))
            return n
    }
    return 0
}

function decideSignal(row, top20Set) {
    if (typeof row.Symbol !== 'string' || row.Symbol.length === 0) {
        return { signal: 'hold', reason: 'Symbol is missing or invalid' }
    }
    if (!isInTop20(row.Symbol, top20Set)) {
        return {
            signal: 'buy',
            reason: 'Symbol is not in the S&P 500 top-20 set (consider buying more)',
        }
    }
    const totalReturn = toNumber(row['Total return'])
    if (totalReturn < 0) {
        return {
            signal: 'sell',
            reason: 'Symbol is in the S&P 500 top-20 set with negative total return (consider selling)',
        }
    }
    return {
        signal: 'hold',
        reason: 'Symbol is in the S&P 500 top-20 set with non-negative total return',
    }
}

class GeneratePortfolioPlan {
    constructor(getTop20, _options = {}) {
        this.getTop20 = getTop20
    }

    async execute(rows) {
        const top20 = this.getTop20()
        if (!Array.isArray(top20)) {
            return rows.map(r => ({ ...r, signal: 'hold', reason: 'Top-20 set unavailable' }))
        }
        return rows.map((row) => {
            const { signal, reason } = decideSignal(row, top20)
            return { ...row, signal, reason }
        })
    }
}

module.exports = { decideSignal, GeneratePortfolioPlan }
