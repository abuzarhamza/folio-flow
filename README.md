# FolioFlow: Momentum Strategy Analyzer

FolioFlow is a specialized Command Line Interface (CLI) application built out of a strict Domain-Driven Design (DDD) architecture. It automates the retrieval of historical pricing and the calculation of the Relative Strength Index (RSI) across distinct time-horizons (22, 44, and 66 periods). Designed specifically to support quantitative momentum analysis, the system targets both individual stock evaluation and broad S&P 500 batch operations.

> FolioFlow is a mechanical analysis tool. It does not provide financial advice.

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
})()
```

Inject custom adapters (e.g. for testing without network access):

```js
const FolioFlow = require('folioflow')

const mockYahoo = {
    getHistoricalPrices: async () => [/* fixture prices */],
}
const ff = new FolioFlow({ yahooFinance: mockYahoo })
```

Errors are thrown as `Error` subclasses — `InvalidSymbolError`, `AdapterError`, `MissingHoldingsError` — all extending `FolioFlowError`. Catch them with `instanceof`.

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

### 4. Portfolio Plan
Takes a JSON file describing the Trader's current portfolio and augments each row with a `signal` (buy / sell / hold) and a `reason` string, based on a momentum-based top-20 rule against the S&P 500.

> Plan signals are a mechanical rule, not financial advice. Consult a licensed advisor before acting on them.

**Rule (v1)**:
- Buy if not in the S&P 500 top-20 set.
- Sell if in the top-20 set and `Total return` is strictly negative.
- Hold otherwise.

*(Note: Requires `--sync-spy` to be run at least once prior so that `snp500.json` exists in the working directory.)*

```bash
node index.js plan my_portfolio.json
```

**Input Shape (`my_portfolio.json`)**:
A plain JSON array of objects with English-cased field names.

A complete 4-row worked example ships with the package at `docs/example-portfolio.json` — copy it (and the sibling NOTICE) to start:
```bash
cp docs/example-portfolio.json my_portfolio.json
cp docs/example-portfolio.NOTICE.txt my_portfolio.NOTICE.txt
# Read my_portfolio.NOTICE.txt before editing the JSON.
```

The same content, inline:
```json
[
    {
        "Name": "Apple Inc.",
        "Symbol": "AAPL",
        "Shares": 12,
        "Price": 191.05,
        "Average cost": 178.42,
        "Total return": 151.56,
        "Equity attribute": "stock"
    },
    {
        "Name": "Microsoft Corp.",
        "Symbol": "MSFT",
        "Shares": 8,
        "Price": 410.20,
        "Average cost": 435.20,
        "Total return": -200.00,
        "Equity attribute": "stock"
    },
    {
        "Name": "Alphabet Inc.",
        "Symbol": "GOOGL",
        "Shares": 5,
        "Price": 178.50,
        "Average cost": 168.50,
        "Total return": 50.00,
        "Equity attribute": "stock"
    },
    {
        "Name": "Burlington Stores",
        "Symbol": "BURL",
        "Shares": 2,
        "Price": 245.00,
        "Average cost": 230.00,
        "Total return": 30.00,
        "Equity attribute": "etf"
    }
]
```

The four rows above cover all three signal branches: `AAPL` and `GOOGL` are in the S&P 500 top-20 with non-negative returns (`hold`), `MSFT` is in the top-20 with a negative return (`sell`), and `BURL` is outside the top-20 (`buy`). Prices and returns are realistic but not real-time quotes — the example teaches the *shape*, not the market.

**Output (`stdout`)**:
```json
{ "status": "success", "rowCount": 1, "signalCounts": { "buy": 0, "sell": 0, "hold": 1 }, "file": "plan.json" }
```

**Output file (`./plan.json`)**:
```json
[
    {
        "Name": "Apple Inc.",
        "Symbol": "AAPL",
        "Shares": 12,
        "Price": 191.05,
        "Average cost": 178.42,
        "Total return": 151.56,
        "Equity attribute": "stock",
        "signal": "hold",
        "reason": "Symbol is in the S&P 500 top-20 set with non-negative total return"
    }
]
```

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
