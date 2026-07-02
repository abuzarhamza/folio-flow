/**
 * Infrastructure adapter for the unofficial Robinhood private API.
 *
 * The login flow and the positions endpoint are documented in
 * https://github.com/sanko/Robinhood (an unofficial description of
 * Robinhood's private API). This adapter is a stub in this slice —
 * the real HTTP calls are added in later slices.
 */
class RobinhoodAdapter {
    async login(_credentials) {
        throw new Error('RobinhoodAdapter.login not implemented yet.')
    }

    async fetchPositions(_token) {
        throw new Error('RobinhoodAdapter.fetchPositions not implemented yet.')
    }
}

module.exports = RobinhoodAdapter
