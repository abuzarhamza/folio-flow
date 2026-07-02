# FolioFlow: Momentum Strategy Analyzer

FolioFlow is a specialized Command Line Interface (CLI) application built out of a strict Domain-Driven Design (DDD) architecture. It automates the retrieval of historical pricing and the calculation of the Relative Strength Index (RSI) across distinct time-horizons (22, 44, and 66 periods). Designed specifically to support quantitative momentum analysis, the system targets both individual stock evaluation and broad S&P 500 batch operations.

## Features

- **Multi-Period RSI Calculation**: Instantly computes RSI(22), RSI(44), and RSI(66) using the `technicalindicators` library driven by Yahoo Finance (`yahoo-finance2`).
- **State Street ETF Scraper**: Dynamically fetches and extracts up-to-date accurate S&P 500 constituent components directly from the official State Street `.xlsx` asset spreadsheets.
- **Rate-Limited Batch Processing**: Safely processes 500+ symbols sequentially utilizing guaranteed queue delays over network fetches to inherently prevent IP rate-limiting flags.
- **Silent JSON Outputs**: Preserves total command-line utility by outputting strictly parseable `.json` text over `stdout`.
- **Diagnostic Tracing**: Leverages `debug` libraries routing network diagnostics over `stderr` using `DEBUG` environment namespaces so pipeline tracking doesn't corrupt underlying json targets.

## Prerequisites

- Node.js (v18.0.0 or higher recommended to utilize the native Fetch API)
- NPM (Node Package Manager)

## Installation

1. Clone or navigate to the project directory:
   ```bash
   cd folioflow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Install globally to use `folioflow` as a command:
   ```bash
   npm install -g .
   folioflow rsi AAPL
   ```

## Usage as a Node Module

FolioFlow's library entry (`index.js`) is side-effect-free: importing it never starts the CLI, writes to stdout, or exits the process. The `FolioFlow` class wires the same application services the CLI uses, with optional dependency injection for testing.

```js
const FolioFlow = require('folioflow')

const ff = new FolioFlow();

(async () => {
    // Single-symbol RSI
    const aapl = await ff.getRSI('AAPL')
    console.log(aapl)
    // => { symbol: 'AAPL', rsi_22: 53.82, rsi_44: 55.67, rsi_66: 55.95, rsi_avg: 55.15 }

    // S&P 500 holdings sync
    const tickers = await ff.syncSPYHoldings()
    // => ['AAPL', 'MSFT', ...]

    // Batch RSI over a list of tickers
    const results = await ff.runBatchRSIs(['AAPL', 'MSFT', 'GOOG'])
    // => [{ symbol, rsi_22, rsi_44, rsi_66, rsi_avg }, ...]

    // Robinhood portfolio dump (returns the array; the CLI writes the file)
    // On the first run the use case needs a username and password; subsequent
    // runs reuse a cached device token at ~/.folioflow/robinhood_device_token.
    const positions = await ff.dumpRobinhoodPortfolio({
        username: process.env.ROBINHOOD_USERNAME,
        password: process.env.ROBINHOOD_PASSWORD,
    })
    // => [{ symbol, quantity, average_buy_price, current_price,
    //      market_value, unrealised_pl, unrealised_pl_pct }, ...]
})()
```

Inject custom adapters (e.g. for testing without network access):

```js
const FolioFlow = require('folioflow')

const mockYahoo = {
    getHistoricalPrices: async () => [/* fixture prices */],
}
const ff = new FolioFlow({ yahooFinance: mockYahoo })

// Inject a mock Robinhood adapter to test dumpRobinhoodPortfolio offline.
// The adapter must expose login({ username, password, mfaCode? }) and
// fetchPositions(token). The use case normalises the response into the
// FolioFlow-owned Position shape — your mock should return raw Robinhood
// JSON; the use case handles the field mapping.
const mockRobinhood = {
    login: async () => 'FAKE-DEVICE-TOKEN',
    fetchPositions: async () => ([
        { symbol: 'AAPL', quantity: '12', average_buy_price: '178.42', current_price: '191.05', market_value: '2292.60', unrealised_pl: '151.56' },
    ]),
}
const ff2 = new FolioFlow({ robinhood: mockRobinhood })
const positions = await ff2.dumpRobinhoodPortfolio({ username: 'u', password: 'p' })
// positions[0] has the canonical 7-key Position shape
```

Errors are thrown as `Error` subclasses — `InvalidSymbolError`, `AdapterError`, `MissingHoldingsError`, `RobinhoodAuthError` — all extending `FolioFlowError`. Catch them with `instanceof`.

The package version is exposed as `FolioFlow.version` (and as the named export `version`).

## Usage as a CLI

FolioFlow has 3 explicit data-extraction modalities.

### 1. Single Symbol Inspection
Analyzes a single specific stock symbol and outputs the result payload instantly.
```bash
node index.js AAPL
```
**Output (`stdout`)**:
```json
{ "symbol": "AAPL", "rsi_22": 53.82, "rsi_44": 55.67, "rsi_66": 55.95 }
```

### 2. S&P 500 Constituency Sync
Downloads the official latest SPY holdings and serializes the 500 tickers arrays into a localized context schema.
```bash
node index.js --sync-spy
```
**Output (`stdout`)**:
```json
{ "status": "success", "tickersCount": 502, "file": "snp500.json" }
```

### 3. S&P 500 Hardware Batch Run
Executes the heavy chronological execution pipeline. This operation utilizes fixed time-delays (e.g. 1 second per fetch) across all synchronized stocks guaranteeing you aren't API banned. This process typically takes about 8+ minutes. Results are dumped securely into `spy_rsi_results.json`.
 *(Note: Requires `--sync-spy` to be run at least once prior)*
```bash
node index.js --batch-spy
```

### 4. Robinhood Portfolio Dump
Authenticates against Robinhood on the Trader's behalf and writes the current open stock/ETF positions to `robinhood_portfolio.json` in the working directory. The first run prompts for username and password (and an MFA code if challenged); subsequent runs reuse a cached device token at `~/.folioflow/robinhood_portfolio.json` and are non-interactive.
```bash
node index.js dump-rh
```
**Output (`stdout`)**:
```json
{ "status": "success", "positionsCount": 3, "file": "robinhood_portfolio.json" }
```
**Output file (`./robinhood_portfolio.json`)**:
```json
{
    "asOf": "2026-07-01T19:00:00.000Z",
    "positions": [
        {
            "symbol": "AAPL",
            "quantity": 12,
            "average_buy_price": 178.42,
            "current_price": 191.05,
            "market_value": 2292.60,
            "unrealised_pl": 151.56,
            "unrealised_pl_pct": 7.08
        }
    ]
}
```
*Note: This subcommand authenticates against Robinhood's private, undocumented API. Use at your own risk; account restrictions are possible. See `docs/adr/0005-robinhood-portfolio-dump.md` for the rationale.*

### Tracking & Debugging (Opt-in Tracing)

Because output data is highly rigid JSON logic, all console `stdout` pollution had to be avoided. You can trace what the network queue is functionally processing in the background by setting the `DEBUG` environment variable which directs specific diagnostics securely through `stderr`.

Display all active processes:
```bash
DEBUG=folioflow:* node index.js AAPL
```
Display only the Batch queue progress limit tracker:
```bash
DEBUG=folioflow:batch node index.js --batch-spy
```
Display only the Yahoo API boundaries:
```bash
DEBUG=folioflow:api node index.js AAPL
```

## Internal Architecture

This system leverages Domain-Driven Design (DDD) to abstract logic cleanly into boundaries ensuring testing flexibility without dependency locks:
- **Presentation (`index.js`)**: Routes initial argument handling pipelines.
- **Application (`src/application/`)**: Orchestrates functional combinations like resolving queues, formatting variables and determining rate-limits.
- **Infrastructure (`src/infrastructure/`)**: Manages the messy network IO bound edges connecting externally with Yahoo Finance API arrays and State Street binary buffers.

### Testing

Tests are written heavily focusing on public structural boundaries avoiding IO constraints using Mock Timers and fake service models. Follow the `npm run test` pattern.

```bash
npm test
```
