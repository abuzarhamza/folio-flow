## What to build

Implement the `--batch-spy` command framework. Build the `BatchCalculateRSIs` Application Service, which retrieves the symbols from `snp500.json` and iteratively executes the existing `GetStockRSIs` service for every stock. Crucially, the service must employ an asynchronous delay (e.g., 1 second) between each API request to prevent Yahoo Finance from issuing rate limit bans. 

If a specific stock errors out, the pipeline should safely log the error and proceed to the next stock without stopping the entire batch. Once all stocks are evaluated, the service must write the master array of RSI results to `spy_rsi_results.json`. Wire `index.js` to run this via the `--batch-spy` flag.

## Acceptance criteria

- [x] Running `node index.js --batch-spy` processes all symbols in `snp500.json` sequentially.
- [x] A minimum 1-second delay is enforced exclusively between fetches to guard against rate limits.
- [x] Errors resolving specific tickers do not crash the batch loop.
- [x] The final data output is successfully compiled and written to `spy_rsi_results.json`.
- [x] Unit tests using Jest fake timers verify the sequential sleep behavior and error boundary logic.

## Blocked by

- `prd-md/issue/3-sync-spy-command.md` (Issue 3)
