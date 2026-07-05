class FolioFlowError extends Error {
    constructor(message) {
        super(message)
        this.name = this.constructor.name
    }
}

class InvalidSymbolError extends FolioFlowError {}
class AdapterError extends FolioFlowError {}
class MissingHoldingsError extends FolioFlowError {}

module.exports = {
    FolioFlowError,
    InvalidSymbolError,
    AdapterError,
    MissingHoldingsError,
}
