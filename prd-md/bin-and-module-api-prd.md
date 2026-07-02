## Problem Statement

FolioFlow is currently a CLI that can only be invoked as `node index.js <command>`. It is not installable as an executable, and its package entry point (`main: "index.js"`) is the yargs CLI itself, so importing `folioflow` as a Node module triggers CLI side effects and exposes no usable programmatic surface beyond `cli.run`. Users who want to:

- install FolioFlow globally and run it as `folioflow rsi AAPL`
- embed FolioFlow's momentum/RSI logic in their own Node code (e.g. a web dashboard, a cron job, a backtest harness)

cannot do either today. The first group has to remember the `node index.js` incantation; the second group has to reach into `src/cli.js` and call internal handlers, which are presentation-coupled.

## Solution

Make FolioFlow both a global CLI and a first-class Node module, with a single, clean library entry point and a thin executable shim.

- The root `index.js` becomes a side-effect-free **library entry**. Importing it never invokes yargs, never touches stdout, and never exits the process. It exposes a documented public API (a `FolioFlow` class with methods like `getRSI(symbol)`, `syncSPYHoldings()`, `runBatchRSIs()`) that wires the existing application services (`GetStockRSIs`, `BatchCalculateRSIs`) against injected infrastructure adapters.
- A new `bin/folioflow.js` is added: a tiny executable shim with a shebang that calls the CLI run function from the library entry. The shim owns the yargs presentation (`src/cli.js`) and is the only file allowed to call `process.exit`.
- `package.json` is updated to register `bin: { "folioflow": "bin/folioflow.js" }` and point `main` at the library entry, so `npm install -g .` works and `require('folioflow')` returns the public API.
- CLI output gains an opt-in `--pretty` flag (default stays plain JSON) and exits are kept clean so the module is embeddable.

The existing CLI subcommands (`rsi`, `sync-spy`, `batch-spy`), their behavior, flags, and JSON output shape, remain unchanged for backwards compatibility. Existing tests must continue to pass.

## User Stories

1. As a terminal user, I want to run `npm install -g foliogflow` and then `folioflow rsi AAPL`, so that I don't have to remember or type `node index.js` every time.
2. As a terminal user, I want `folioflow --help` to show the same commands and descriptions I get today, so that my muscle memory and scripts keep working.
3. As a terminal user, I want to pass `--pretty` to `folioflow rsi AAPL` and get indented JSON, so that I can read the result without piping through `jq`.
4. As a terminal user, I want all three existing subcommands (`rsi`, `sync-spy`, `batch-spy`) to work identically via the new `bin/folioflow.js` entry, so that the upgrade is transparent.
5. As a terminal user, I want `folioflow rsi AAPL` to keep writing JSON to stdout and diagnostics to stderr, so that my existing shell pipelines still work.
6. As a Node developer, I want to `const FolioFlow = require('folioflow')` and instantiate it, so that I can use FolioFlow's logic from my own code.
7. As a Node developer, I want `new FolioFlow().getRSI('AAPL')` to return a plain JS object with the RSI result, so that I can use it without parsing JSON.
8. As a Node developer, I want to inject my own infrastructure adapters (e.g. a fixture-backed `YahooFinanceAdapter`) so that I can test code that uses FolioFlow without hitting the network.
9. As a Node developer, I want `require('folioflow')` to have **no side effects**: no stdout writes, no `process.exit`, no filesystem writes, so that importing the library in a server context is safe.
10. As a Node developer, I want the library API to also expose `syncSPYHoldings()` and `runBatchRSIs()` as async methods returning parsed results, so that I can run the full S&P 500 pipeline programmatically.
11. As a Node developer, I want clear errors thrown as `Error` subclasses (e.g. `FolioFlowError`, `InvalidSymbolError`) rather than strings written to stderr, so that I can `try/catch` and inspect them.
12. As a Node developer, I want the library to expose its version (`FolioFlow.version` or via `require('folioflow/package.json').version`), so that I can log it for debugging.
13. As a maintainer, I want `index.js` to be the **only** place the public API surface is defined, so that there is one obvious seam for the library entry.
14. As a maintainer, I want `bin/folioflow.js` to be the **only** place that imports `src/cli.js` and calls `process.exit`, so that presentation concerns are isolated from the library.
15. As a maintainer, I want the existing Jest suite (layer tests + `index.test.js` CLI integration tests) to keep passing unchanged, so that the refactor is provably non-breaking.
16. As a maintainer, I want a new test file that imports the library entry and exercises the public API with mocked adapters, so that the module surface is regression-protected.
17. As a maintainer, I want the `bin` field in `package.json` to be the source of truth for the executable name, so that `npm install -g` installs `folioflow`.
18. As a maintainer, I want `main` in `package.json` to point at the side-effect-free library entry, so that `require('folioflow')` returns the public API and does not bootstrap the CLI.
19. As a maintainer, I want a README section documenting both the CLI install path and the module usage path, so that new users can discover both.
20. As a CI maintainer, I want `npm test` to cover both the CLI integration tests and the new module API tests in one run, so that CI catches regressions in either surface.

## Implementation Decisions

- **Library entry lives in `index.js`**: `index.js` is refactored from "yargs CLI bootstrap" to a side-effect-free module that exports the public API. It does not import yargs, does not call `process.argv`, and does not call `process.exit`.
- **Public API shape**: a single `FolioFlow` class is exported as the default export. It also has the named exports `FolioFlow`, `version`, and a `create` factory. The class constructor accepts an optional `adapters` object (e.g. `{ yahooFinance, spyHoldings }`) for DI; absent adapters, defaults instantiate the production adapters. Methods: `getRSI(symbol)`, `syncSPYHoldings()`, `runBatchRSIs(tickers?)`. All are async and return plain JS objects.
- **Executable shim in `bin/folioflow.js`**: a thin file with `#!/usr/bin/env node` that requires the library entry, calls its `runCLI(argv)` method (or invokes `src/cli.js` with the same argv), and lets `src/cli.js` own `process.exit` and stdout/stderr. The shim itself does zero work besides delegating.
- **Presentation stays in `src/cli.js`**: unchanged in behavior. It is the only file that writes to stdout/stderr directly and calls `process.exit`. It now receives the wired application services from the library entry rather than instantiating adapters itself, so CLI and library share one wiring path.
- **`package.json` updates**:
  - `main` → library entry (side-effect-free).
  - `bin` → `{ "folioflow": "bin/folioflow.js" }`.
  - `files` array added so `npm publish` ships `index.js`, `bin/`, and `src/` (not `node_modules`, not tests).
  - `scripts.start` added: `node bin/folioflow.js` for convenience.
- **CLI output**: default is plain JSON (unchanged). A new top-level `--pretty` boolean flag is added to yargs; when set, JSON output is `JSON.stringify(result, null, 2)`. Errors still go to stderr via `chalk.red` and exit code 1.
- **Error model for the library**: `getRSI` / `syncSPYHoldings` / `runBatchRSIs` throw `Error` subclasses (`FolioFlowError` base; `InvalidSymbolError`, `AdapterError`, `MissingHoldingsError` for known failure modes). The CLI catches them and renders them through the existing `chalk.red` stderr path.
- **No new domain layer**: this PRD deliberately does **not** introduce `src/domain/`. The class methods delegate to the existing application services, which is the highest viable seam. Adding a domain layer is a separate concern.
- **DI is opt-in, not mandatory**: the default `new FolioFlow()` instantiates `YahooFinanceAdapter` and `SPYHoldingsAdapter` exactly as the CLI does today, so behavior is identical for unconfigured callers.
- **Versioning**: `FolioFlow.version` reads from `package.json` at module load. A `package.json` `exports` field is **not** added in this PRD (avoids lockfile churn; can be added later).
- **Backwards compatibility**: every existing CLI invocation and every existing test continues to pass with no edits to the test files. The only test changes allowed are additions, not modifications of existing assertions.

## Testing Decisions

- **What makes a good test for this PRD**: assert external behavior of the two surfaces (CLI stdout/exit-code, library return values / thrown errors). Do not assert on the internal shape of `index.js` exports beyond the documented public API.
- **Existing tests stay green**: `index.test.js` (CLI integration via `child_process.execFileSync`), `BatchCalculateRSIs.test.js`, `GetStockRSIs.test.js`, `SPYHoldingsAdapter.test.js` must all pass without modification. They prove the CLI refactor is non-breaking.
- **New module API tests** (`index.module.test.js` or similar): a Jest file that imports the library entry, constructs `new FolioFlow({ yahooFinance: mockAdapter, spyHoldings: mockAdapter })`, and asserts:
  - `getRSI('AAPL')` resolves to an object containing `rsi_22`, `rsi_44`, `rsi_66` (and `rsi_avg` per the in-flight `rsi-avg-prd`).
  - `getRSI('')` rejects with an `InvalidSymbolError`.
  - `require('folioflow')` does not write to `process.stdout` (spy on `process.stdout.write`).
  - `require('folioflow')` does not call `process.exit` (spy on `process.exit`).
  - `FolioFlow.version` is a semver string.
- **New CLI shim test** (lightweight, can live alongside `index.test.js`): spawn `node bin/folioflow.js rsi AAPL` and assert the same stdout/exit-code behavior as `node index.js rsi AAPL`. Asserts the shim is wired correctly.
- **Prior art**: the existing `jest.mock` pattern in `index.test.js` (auto-mocking adapters at the resolved path) is the template for the new module API tests.
- **No new test framework, no new assertion library**: Jest only.
- **No coverage gate added in this PRD**: out of scope; can be wired later.

## Out of Scope

- Introducing a `src/domain/` layer or Domain entities/value objects.
- A `package.json` `exports` field with conditional subpaths.
- TypeScript types or `.d.ts` generation.
- Publishing to npm (the `files` field is configured, but no publish workflow is added).
- A `--format=table` or other non-JSON output modes beyond the `--pretty` indented JSON flag.
- Renaming the package, changing the executable name, or adding shell completions.
- Refactoring the existing application services (`GetStockRSIs`, `BatchCalculateRSIs`) — they are consumed as-is.
- Adding a programmatic streaming/event API (e.g. progress events for `runBatchRSIs`).
- CI configuration changes.
- Backwards-compatibility shims for anyone who was already `require('folioflow')` and getting the CLI side effect (this was never a documented public surface).

## Further Notes

- The earlier conversation chose yargs + chalk + JSON output + subcommands, all of which already exist and are preserved. The `--pretty` flag is the only additive CLI change.
- The `rsi-avg-prd` and `logger-prd` in `prd-md/` already introduce dependencies the new module API will naturally inherit (the `rsi_avg` field in the return value, the `debug` namespaces for diagnostics). This PRD does not duplicate that work; it only ensures the library surface exposes the same fields the CLI surface emits.
- The `prd.md` at the repo root describes a 4-layer DDD. This PRD keeps the existing 3-layer reality (presentation / application / infrastructure) and treats the missing domain layer as a separate, future PRD.
