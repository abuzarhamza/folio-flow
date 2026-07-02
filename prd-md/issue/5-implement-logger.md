## What to build

Implement the tracing architecture defined in `logger-prd.md`. Install the `debug` npm library. Inject specific namespaced debugger instances across three integrated layers:
1. `index.js` -> `folioflow:cli`
2. `src/application/BatchCalculateRSIs.js` -> `folioflow:batch`
3. `src/infrastructure/YahooFinanceAdapter.js` -> `folioflow:api`

Sprinkle useful tracking statements internally (such as tracking when an API is called, and batch progress updates highlighting current symbol queues). Ensure running it without the `DEBUG` environment variable leaves the standard console functionality exactly as is.

## Acceptance criteria

- [x] `debug` package is installed in `package.json`.
- [x] `debug('folioflow:cli')` instances operate in CLI configuration context.
- [x] `debug('folioflow:batch')` logs progress dynamically reflecting `(X / Total)` during iteration.
- [x] `debug('folioflow:api')` safely outputs payload tracing upon Yahoo Finance fetching.
- [x] `stdout` JSON integrity remains unaffected by tracing.

## Blocked by

- None - can start immediately
