## What to build

Build the core Application Service, `GetStockRSIs`, which handles the business logic. It will take the closing prices retrieved by the Infrastructure layer and pass them to `technicalindicators` to calculate the RSI values for periods extending 22, 44, and 66 days. Extract the very last array value from each calculation to form the final desired RSI state. Update the `index.js` presentation layer so it outputs the exact JSON payload.

You will also add Application-level unit tests for the `GetStockRSIs` service, ensuring `yahoo-finance2` infrastructure is mocked to prevent network calls while asserting that the calculations are accurate and robust.

## Acceptance criteria

- [x] The `GetStockRSIs` service calculates RSI lengths 22, 44, and 66 using `technicalindicators`.
- [x] Running `node index.js <SYMBOL>` now outputs the finalized JSON: `{"symbol": "<SYMBOL>", "rsi_22": X, "rsi_44": Y, "rsi_66": Z}`.
- [x] The Application Service has tests validating business logic using mocked data (no outgoing network requests during `npm test`).
- [x] The system maintains the clean 4-layer DDD architecture with clear separation of concerns.

## Blocked by

- `1-basic-cli-pipeline.md` (Issue 1)
