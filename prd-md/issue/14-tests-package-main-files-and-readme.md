# 14 — Module API tests, `package.json` `main`/`files`, and README

## Parent

- PRD: `prd-md/bin-and-module-api-prd.md`

## What to build

Flip the `main` field in `package.json` to point at the library entry (the now-side-effect-free `index.js`), add a `files` array so `npm publish` ships the right artifacts, expand the Jest suite with module API tests that lock in the public surface, and document both install paths in the README.

This is the final integration slice: it proves the library entry is the canonical surface, ships the right files, and tells users how to use both forms.

## Acceptance criteria

- [ ] `package.json` `main` points at the side-effect-free library entry (no longer the yargs bootstrap).
- [ ] `package.json` includes a `files` array containing `index.js`, `bin/`, `src/`, `README.md`, and `package.json` — and explicitly excludes tests, `.eslintrc`, `node_modules`, and other dev-only files.
- [ ] A new Jest file (e.g. `index.module.test.js`) covers the public API:
  - `new FolioFlow().getRSI('AAPL')` returns an object with the expected RSI fields (using mocked adapters).
  - `new FolioFlow({ yahooFinance: mock }).getRSI('AAPL')` uses the injected adapter.
  - `new FolioFlow().syncSPYHoldings()` returns an array (using mocked adapter).
  - `new FolioFlow().runBatchRSIs(['AAPL','MSFT'])` returns the expected payload.
  - `require('./index.js')` produces no `process.stdout.write` calls and no `process.exit` calls (side-effect-free).
  - `FolioFlow.version` is a semver string.
- [ ] The existing CLI integration tests (`index.test.js`) and layer tests still pass without modification.
- [ ] `README.md` has a new section documenting both surfaces:
  - CLI install path: `npm install -g .` then `folioflow <command>`.
  - Module usage path: `const FolioFlow = require('folioflow'); const ff = new FolioFlow(); await ff.getRSI('AAPL');` with a short example.
- [ ] `npm test` runs both the existing suite and the new module API tests in one invocation.

## Blocked by

- Issue #13 — Public API surface, error subclasses, and `--pretty` flag

## Status

- [x] Done — `package.json` `main` is the side-effect-free library entry, `files` array added, `scripts.start` wired to `bin/folioflow.js`. README has a new "Usage as a Node Module" section with example + DI + error notes; CLI section now mentions `--pretty` and the three invocation forms. Module API tests in `index.module.test.js` lock in the public surface.
