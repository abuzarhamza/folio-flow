## Problem Statement

The application runs a lengthy batch operation (taking over 8 minutes for 500 stocks due to rate-limit mitigation queues) over the network. Users currently have no visibility into the progress of this internal execution unless they wait for it to finish. However, manually inserting `console.log` statements throughout the code corrupts the application's core feature: emitting pure, parseable JSON on `stdout`. There is a need for robust, opt-in execution tracing that separates diagnostic output from script payload output.

## Solution

Following the paradigm utilized by tools like Mongoose, we will integrate the lightweight `debug` NPM package. This enables opt-in tracing driven by the `DEBUG` environment variable and guarantees that all internal logs process exclusively through `stderr` (Standard Error) rather than `stdout`, preserving downstream JSON pipes.

## User Stories

1. As a developer debugging execution pathways, I want to run `DEBUG=folioflow:* node index.js AAPL` so that I can trace all operations end-to-end.
2. As a trader running the 8-minute batch update, I want to execute `DEBUG=folioflow:batch node index.js --batch-spy` so that I can see live progress (e.g., "Processing AAPL 1/500") without interfering with the final `spy_rsi_results.json` generation.
3. As an engineer tracing rate-limits and network faults, I want to use the `folioflow:api` namespace to isolate exactly which HTTP request failed in the `YahooFinanceAdapter`.
4. As an automated consumer bot running this script on a cron-job, I want all standard functionality to remain silent and output valid JSON exactly as it did before if no `DEBUG` variables are provided.

## Implementation Decisions

- **Dependency**: Utilize the standard `debug` package maintained by the Node foundation ecosystem.
- **Log Routing**: Require no complex file routing; `debug` natively writes to `stderr`.
- **Namespaces**:
  - `debug('folioflow:cli')` inside `index.js` for argument parsing and setup.
  - `debug('folioflow:batch')` inside `src/application/BatchCalculateRSIs.js` for iterating through S&P500 stocks.
  - `debug('folioflow:api')` inside `src/infrastructure/YahooFinanceAdapter.js` for historical timeline data-fetching events.
- **Execution Style**: Loggers should output meaningful tracking info (e.g. `[Batch] Fetching symbol... delay starting`).

## Testing Decisions

- Because `debug` heavily overrides console standard streams and involves implementation details (log statements themselves), strictly unit-testing standard log outputs creates heavily brittle tests (the classic anti-pattern noted in the TDD skill). 
- We will manually verify the visual formatting of the `stderr` logs, but we will not add unit tests enforcing specific arbitrary log strings, thereby preserving refactoring durability.

## Out of Scope

- Implementing hefty backend logger file persistency (like `winston` output files or Logstash streaming).
- Complex log levels (INFO, WARN, FATAL) mappings. `debug` focuses purely on transparent tracing.
