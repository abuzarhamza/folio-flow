## Parent

prd-md/yargs-chalk-cli-prd.md

## What to build

Implement the `sync-spy` and `batch-spy` subcommands end-to-end through the Presentation layer. Replace the `--sync-spy` and `--batch-spy` flag branches of `index.js`. Both subcommands take no arguments.

- `sync-spy`: invoke `SPYHoldingsAdapter.fetchTickers()`, write `snp500.json`, print plain JSON success payload to stdout.
- `batch-spy`: validate `snp500.json` exists (yellow warning + exit non-zero if missing), then invoke `BatchCalculateRSIs.execute(...)`, write `spy_rsi_results.json`, print plain JSON success payload to stdout.

Errors print red to stderr and exit non-zero. No change to `src/application/*` or `src/infrastructure/*`.

## Acceptance criteria

- [x] `node index.js sync-spy` exits 0, writes `snp500.json`, prints JSON status to stdout.
- [x] `node index.js batch-spy` exits 0, writes `spy_rsi_results.json`, prints JSON status to stdout.
- [x] `node index.js batch-spy` without `snp500.json` exits non-zero with a yellow warning.
- [x] `node index.js batch-spy BOGUS` (extra arg) exits non-zero due to strict mode.
- [x] No reference to `--sync-spy` or `--batch-spy` flag style remains in `index.js`.
- [x] All success stdout payloads remain valid JSON with no chalk codes.

## Blocked by

- 7-yargs-chalk-scaffold