## Problem Statement

The user wants to analyze the momentum of the broader market by calculating the Relative Strength Index (RSI) for all 500 constituent stocks of the S&P 500 index. Currently, the CLI tool only supports single-stock analysis. Manually running the tool 500 times is impractical, and simultaneously fetching all 500 symbols would lead to Yahoo Finance API rate limits (HTTP 429 Too Many Requests) and potential IP blacklisting.

## Solution

Extend the CLI to support bulk S&P 500 processing by splitting the process into two safe, explicit steps:
1. Support downloading the official State Street SPY holdings spreadsheet, converting it into a local `snp500.json` file.
2. Support batch-processing the tickers in `snp500.json` by calculating the RSI (22, 44, 66) for each stock sequentially. A deliberate delay (e.g., 1 second) is enforced between requests to prevent API rate limiting. The final aggregated results are dumped into `spy_rsi_results.json`.

## User Stories

1. As a momentum trader, I want to run `node index.js --sync-spy` so that I can automatically download and parse the latest S&P 500 constituents into a neat JSON list.
2. As a CLI user, I want the sync process to read directly from the official State Street `.xlsx` asset URL so that the symbol list is highly accurate and up-to-date.
3. As an algorithmic trader, I want to run `node index.js --batch-spy` to automatically crunch the RSI (22, 44, 66) for every S&P 500 stock.
4. As a responsible consumer of free APIs, I want the batch script to pause briefly between each ticker fetch so my IP does not get blacklisted by Yahoo.
5. As an analyst running a massive batch job, I want the output to save directly to `spy_rsi_results.json` instead of flooding my console, so I can easily pipe it into other systems.

## Implementation Decisions

- **Infrastructure Adapter (SPY)**: Create an `SPYHoldingsAdapter` to fetch and parse the Excel file from State Street using the `xlsx` NPM package. (Must install `xlsx` dependency).
- **Application Service (Batch)**: Create a `BatchCalculateRSIs` service that loads `snp500.json`, loops through each symbol, calls the existing `GetStockRSIs`, enforces a fixed delay using `setTimeout`, and writes the array to `spy_rsi_results.json`.
- **Presentation (CLI)**: Update `index.js` to recognize `--sync-spy` and `--batch-spy` arguments, invoking the respective application pathways instead of the single-symbol path.
- **Rate Limiting Mechanism**: A simple `await new Promise(r => setTimeout(r, 1000))` (1 second) inserted sequentially between ticker requests.
- **Failures in Batch**: If one ticker fails to fetch, log the error but *continue* the batch processing loop so the entire 500-stock run isn't thrown away due to one bad ticker.

## Testing Decisions

- **Testing Seams**: 
  - The `SPYHoldingsAdapter` will be tested by providing a mocked, stripped-down dummy Excel buffer or mocking the HTTP response entirely.
  - The `BatchCalculateRSIs` service will be tested by mocking `GetStockRSIs.execute` and checking that `setTimeout` (via Jest Fake Timers) is called between executions, ensuring the batch doesn't crash on individual ticker errors.
- External IO (file writing to `spy_rsi_results.json`) inside tests should be mocked using mock-fs or by mocking the `fs` module to prevent polluting the repository with test artifacts.

## Out of Scope

- Concurrency pools (e.g., fetching 5 at a time). We are strictly adhering to fully sequential execution for maximum safety.
- Database persistence. Files (`.json`) are strictly used.
- Auto-scheduling via CRON (the user must run the commands manually).
