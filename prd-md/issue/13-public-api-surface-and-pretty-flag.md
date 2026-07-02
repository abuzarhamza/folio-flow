# 13 — Public API surface, error subclasses, and `--pretty` flag

## Parent

- PRD: `prd-md/bin-and-module-api-prd.md`

## What to build

Complete the library's public API: add `syncSPYHoldings()` and `runBatchRSIs(tickers?)` methods on `FolioFlow`, introduce a small hierarchy of `Error` subclasses for known failure modes, expose `FolioFlow.version` read from `package.json`, and add an opt-in `--pretty` yargs flag for indented JSON output.

This slice is additive — it does not change the behavior of any previously-shipped method. The `--pretty` flag is the only CLI change: when set, the CLI prints `JSON.stringify(result, null, 2)` instead of compact JSON. Default output stays plain JSON.

## Acceptance criteria

- [ ] `FolioFlow.prototype.syncSPYHoldings()` resolves to an array of ticker strings and writes the same `snp500.json` the CLI does today.
- [ ] `FolioFlow.prototype.runBatchRSIs(tickers?)` resolves to the same payload shape as the `batch-spy` CLI command. When `tickers` is omitted, it reads from the existing `snp500.json` (or throws `MissingHoldingsError` if absent — matches CLI behavior).
- [ ] A `FolioFlowError` base class is exported, with `InvalidSymbolError`, `AdapterError`, and `MissingHoldingsError` subclasses.
- [ ] `getRSI('')` rejects with `InvalidSymbolError`.
- [ ] `syncSPYHoldings()` rejects with `AdapterError` if the underlying adapter throws.
- [ ] `runBatchRSIs()` rejects with `MissingHoldingsError` if `snp500.json` is absent and no `tickers` argument was provided.
- [ ] `FolioFlow.version` is a semver string matching `package.json` `version`.
- [ ] The CLI catches `FolioFlowError` (and subclasses) and renders them through the existing `chalk.red` stderr path with exit code 1 — no unhandled rejections leak.
- [ ] `folioflow --pretty rsi AAPL` (and equivalent via `bin/folioflow.js`) prints indented JSON. Without `--pretty`, output is compact JSON. Backwards compatible with existing pipelines.
- [ ] All existing Jest tests still pass without modification.

## Blocked by

- Issue #12 — Library entry extraction (side-effect-free `index.js`)

## Status

- [x] Done — `syncSPYHoldings`, `runBatchRSIs`, error subclasses (`FolioFlowError`, `InvalidSymbolError`, `AdapterError`, `MissingHoldingsError`), and `FolioFlow.version` all landed. CLI `--pretty` flag added. All module + CLI tests green.
