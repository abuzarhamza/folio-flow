---
title: "dump-rh: skeleton, error class, CLI wiring"
status: done
blocked_by: []
parent: prd-md/robinhood-portfolio-dump.md
---

## Parent

PRD: `prd-md/robinhood-portfolio-dump.md`

## What to build

A thin vertical slice that introduces the `dump-rh` subcommand end-to-end but does not yet hit the Robinhood API. After this slice:

- `folioflow dump-rh` is a recognised subcommand listed in `--help`.
- Running it without the required infrastructure in place produces a single typed error (`RobinhoodAuthError`) on stderr, in the same red `Error:` style as existing FolioFlow errors, and exits non-zero.
- The library surface (`FolioFlow.dumpRobinhoodPortfolio`) throws the same typed error if called without the adapter wired up.
- The existing `index.test.js` integration tests still pass; new tests cover the help-line listing and the error surface.

The point of this slice is to make the feature *demoable* as a stub: a contributor can run `folioflow dump-rh` and see a clean, expected error path before any real auth code lands.

## Acceptance criteria

- [ ] `folioflow --help` output lists `dump-rh` alongside `rsi`, `sync-spy`, `batch-spy`.
- [ ] `folioflow dump-rh` exits non-zero with a red `Error: ...` line on stderr, mentioning that the Robinhood adapter is not configured.
- [ ] `ff.dumpRobinhoodPortfolio(...)` called from a Node script throws a `RobinhoodAuthError` (or an appropriate `FolioFlowError` subclass).
- [ ] `FolioFlowError` hierarchy is extended with `RobinhoodAuthError` and re-exported from the package entrypoint.
- [ ] `index.test.js` extends with two new cases: help output includes `dump-rh`; running `dump-rh` with a stub adapter fails as expected. All previously-passing tests still pass.
- [ ] No production code path reaches the network in this slice. The adapter interface is defined (e.g. `login(...)`, `fetchPositions(token)`) but only as a stub that throws.

## Blocked by

None — can start immediately.
