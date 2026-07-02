class FolioFlowError extends Error {
    constructor(message) {
        super(message)
        this.name = this.constructor.name
    }
}

class InvalidSymbolError extends FolioFlowError {}
class AdapterError extends FolioFlowError {}
class MissingHoldingsError extends FolioFlowError {}
class RobinhoodAuthError extends FolioFlowError {}

module.exports = {
    FolioFlowError,
    InvalidSymbolError,
    AdapterError,
    MissingHoldingsError,
    RobinhoodAuthError,
}
