## What to build

Implement the basic End-to-End framework for the CLI tool following the 4-layer Domain-Driven Design layout. You will need to build the `Infrastructure` adapter wrapping `yahoo-finance2` to fetch the last 1 year of daily historical prices for a given stock symbol. Finally, wire this up to `index.js` (Presentation) so it takes the stock symbol as a positional argument from the command line and outputs the raw number of closing prices retrieved in a basic JSON format. Ensure network errors or invalid stock symbols are caught in the pipeline and output a clean user-defined error instead of a raw stack trace.

## Acceptance criteria

- [x] The folder structure is laid out with `src/domain`, `src/infrastructure`, and `src/application`.
- [x] `yahoo-finance2` is implemented in the infrastructure layer to pull exactly 1 year of historical daily prices.
- [x] Running `node index.js AAPL` fetches the payload and prints a confirmation JSON payload (e.g. `{"symbol": "AAPL", "dataPoints": 252}`).
- [x] Invalid symbols and network errors are caught, and a clean error message is printed to the console rather than a stack trace.

## Blocked by

- None - can start immediately
