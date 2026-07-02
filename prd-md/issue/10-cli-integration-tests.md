## Parent

prd-md/yargs-chalk-cli-prd.md

## What to build

Add CLI integration tests at the highest seam: invoke `index.js` via `child_process.execFileSync` from Jest. Cover all three subcommands end-to-end. Mock the infrastructure layer (Yahoo Finance adapter and SPY holdings adapter) to avoid real network calls. Verify exit codes, stdout JSON shape, stderr messages, and help output. No new mocks should leak into production code.

## Acceptance criteria

- [x] Test file exists (e.g. `index.test.js` or under `tests/cli/`) and runs with `npm test`.
- [x] Test: `rsi AAPL` exits 0 and stdout parses as JSON with the documented RSI shape.
- [x] Test: `rsi` (no symbol) exits non-zero and stderr contains a red-styled error.
- [x] Test: `sync-spy` exits 0 and writes a valid `snp500.json`.
- [x] Test: `batch-spy` without `snp500.json` exits non-zero with a yellow warning.
- [x] Test: `batch-spy` exits 0 and writes `spy_rsi_results.json` from mocked data.
- [x] Test: `--help` exits 0 and mentions all three subcommands.
- [x] Test: unknown command exits non-zero.
- [x] No real network calls occur during the test run (verify via jest mock assertions or by mocking the yahoo-finance2 module).
- [x] All tests pass.

## Blocked by

- 8-rsi-subcommand
- 9-sync-batch-subcommands