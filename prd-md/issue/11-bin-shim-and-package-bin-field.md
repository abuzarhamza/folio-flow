# 11 — Bin shim and package.json `bin` field

## Parent

- PRD: `prd-md/bin-and-module-api-prd.md`

## What to build

Add a thin executable shim at `bin/folioflow.js` that invokes the existing CLI behavior from `src/cli.js`, and register it as the package's `bin` entry so that `npm install -g .` makes `folioflow` available on `PATH`.

The shim is a pass-through: it does not refactor `index.js`, does not introduce a new API surface, and does not change CLI behavior. Its only job is to give users a real executable name and shebang. After this slice, `folioflow rsi AAPL` (via the shim) and `node index.js rsi AAPL` (today's invocation) produce byte-identical stdout, stderr, and exit codes.

The package metadata gets a single new field: `bin: { "folioflow": "bin/folioflow.js" }`. `main` is **not** changed in this slice — it still points at the current `index.js`. The library-side refactor is a later slice.

## Acceptance criteria

- [ ] A new file `bin/folioflow.js` exists with a `#!/usr/bin/env node` shebang on line 1.
- [ ] `bin/folioflow.js` is executable (`chmod +x`).
- [ ] `bin/folioflow.js` delegates to the existing CLI behavior (e.g. requires `src/cli.js` and invokes its `run` function with `process.argv.slice(2)`), with no other logic.
- [ ] `package.json` contains `"bin": { "folioflow": "bin/folioflow.js" }`.
- [ ] `node bin/folioflow.js rsi AAPL` produces the same stdout, stderr, and exit code as `node index.js rsi AAPL` for at least one happy-path invocation and one error invocation (e.g. missing symbol).
- [ ] `node bin/folioflow.js --help` prints the same yargs help text as `node index.js --help`.
- [ ] `npm install -g .` from the repo root installs a `folioflow` binary on `PATH`, and `folioflow --version` (or `--help` if no version flag exists yet) exits 0.
- [ ] All existing Jest tests still pass without modification.
- [ ] `package.json` `main` field is unchanged in this slice (still `index.js`).

## Blocked by

- None — can start immediately.

## Status

- [x] Done — `bin/folioflow.js` created with shebang + executable bit, `package.json` `bin` field added, parity test suite (`bin.test.js`) passing.
