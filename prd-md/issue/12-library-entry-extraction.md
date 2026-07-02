# 12 — Library entry extraction (side-effect-free `index.js`)

## Parent

- PRD: `prd-md/bin-and-module-api-prd.md`

## What to build

Refactor `index.js` from a yargs CLI bootstrap into a side-effect-free library entry that exports a `FolioFlow` class. Migrate `src/cli.js` to use that class so the CLI and the library share one wiring path.

After this slice, `require('folioflow')` (or `require('./index.js')` in tests) does not invoke yargs, does not write to stdout/stderr, and does not call `process.exit`. Default construction (`new FolioFlow()`) wires the production adapters exactly as `src/cli.js` does today, so behavior is unchanged.

This slice is intentionally minimal on public surface: it adds the class skeleton, the `getRSI(symbol)` method (delegating to `GetStockRSIs`), and the migration of `src/cli.js` to consume the class. The remaining public methods (`syncSPYHoldings`, `runBatchRSIs`), error subclasses, and the `--pretty` flag are scoped to the next slice.

## Acceptance criteria

- [ ] `index.js` exports a `FolioFlow` class as the default export and as a named export.
- [ ] `index.js` does not call `yargs`, does not read `process.argv`, does not call `process.stdout.write` or `process.exit` at module load.
- [ ] `new FolioFlow()` constructs without arguments and exposes a `getRSI(symbol)` method that resolves to the same payload shape the CLI currently emits for `rsi <symbol>`.
- [ ] `new FolioFlow({ yahooFinance: mockAdapter, spyHoldings: mockAdapter })` accepts injected adapters (DI) and uses them instead of the defaults.
- [ ] `src/cli.js` is refactored to construct a `FolioFlow` instance and call its methods instead of instantiating `YahooFinanceAdapter` / `SPYHoldingsAdapter` directly.
- [ ] The CLI's three subcommands (`rsi`, `sync-spy`, `batch-spy`) produce identical stdout, stderr, and exit codes to the pre-refactor behavior, verified by `index.test.js` continuing to pass unchanged.
- [ ] `bin/folioflow.js` from the previous slice still works (it can continue to delegate to `src/cli.js`).
- [ ] A new test asserts that `require('./index.js')` does not write to `process.stdout` and does not call `process.exit` (this is the proof the entry is side-effect-free).

## Blocked by

- Issue #11 — Bin shim and package.json `bin` field

## Status

- [x] Done — `index.js` is side-effect-free and exports the `FolioFlow` class. `src/cli.js` migrated to consume the class (no more direct `infrastructure/*` imports). Module tests (`index.module.test.js`) green.
