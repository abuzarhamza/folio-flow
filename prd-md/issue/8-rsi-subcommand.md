## Parent

prd-md/yargs-chalk-cli-prd.md

## What to build

Implement the `rsi <symbol>` subcommand end-to-end through the Presentation layer. Replace the bare-positional branch of `index.js`. yargs must require exactly one positional `symbol` (use `.demandCommand` and positional declaration). On success, invoke `GetStockRSIs.execute(symbol)` and print plain JSON (no chalk) to stdout. On any thrown error, print a red `chalk.red` message to stderr and exit non-zero. Exit code 0 on success. No change to `src/application/*` or `src/infrastructure/*`.

## Acceptance criteria

- [x] `node index.js rsi AAPL` exits 0 and emits valid JSON to stdout matching the existing `GetStockRSIs` shape.
- [x] `node index.js rsi` with no symbol exits non-zero, prints a red error to stderr, and shows usage.
- [x] `node index.js rsi BOGUS` (invalid symbol) exits non-zero with a red error and the original error message preserved.
- [x] Successful stdout contains no chalk color codes.
- [x] The old `node index.js AAPL` form is no longer accepted (exits non-zero with usage).

## Blocked by

- 7-yargs-chalk-scaffold