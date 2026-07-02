---
title: "dump-rh: library API surface (`ff.dumpRobinhoodPortfolio`)"
status: done
blocked_by:
  - 004-dump-rh-file-write-and-status
parent: prd-md/robinhood-portfolio-dump.md
---

## Parent

PRD: `prd-md/robinhood-portfolio-dump.md`

## What to build

A vertical slice that promotes the feature into a first-class library API, completing the symmetry with `getRSI`, `syncSPYHoldings`, and `runBatchRSIs`. After this slice:

- The `FolioFlow` constructor accepts an optional `robinhood` adapter injection point, mirroring the existing `yahooFinance` and `spyHoldings` slots.
- `FolioFlow.dumpRobinhoodPortfolio({ username, password, mfaCode? })` returns the parsed Position array and throws `RobinhoodAuthError` on failure.
- The library API never writes to disk. File IO is reserved to the Presentation-layer CLI handler.
- The README's "Usage as a Node Module" section is updated with a worked example for the new method, including the mock-adapter injection pattern.
- A dependency-injection test demonstrates that an integrator can swap in a mock adapter and run `dumpRobinhoodPortfolio` end-to-end offline.

The CLI integration tests added in slices 1–4 remain green. This slice is the *library-API* half of the contract, complementing the CLI half.

## Acceptance criteria

- [ ] `FolioFlow` accepts an optional `adapters.robinhood` injection.
- [ ] `ff.dumpRobinhoodPortfolio({ username, password })` returns the Position array.
- [ ] `ff.dumpRobinhoodPortfolio` throws `RobinhoodAuthError` (or other typed `FolioFlowError` subclass) on auth failure; it never throws a raw `Error`.
- [ ] `ff.dumpRobinhoodPortfolio` never writes a file, regardless of input. Asserted by a test that runs the method and confirms no `robinhood_portfolio.json` is created.
- [ ] README is updated with a "dumpRobinhoodPortfolio" example alongside `getRSI`, `syncSPYHoldings`, and `runBatchRSIs`.
- [ ] A new test in `index.test.js` (or a small new test file in the same style) covers the dependency-injection pattern: pass a mock adapter, call `dumpRobinhoodPortfolio`, assert the returned array.
- [ ] All previously-passing tests still pass.

## Blocked by

- `004-dump-rh-file-write-and-status`
