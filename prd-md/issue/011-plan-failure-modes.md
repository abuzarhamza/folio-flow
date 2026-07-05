---
title: "plan: failure modes (missing snp500, missing input, malformed input)"
status: ready
blocked_by:
  - 010-plan-core-service-and-cli-render
parent: prd-md/portfolio-plan-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/portfolio-plan-prd.md`

## What to build

A vertical slice that makes the `plan` subcommand's error surfaces explicit and testable. After this slice:

- A Trader who runs `folioflow plan missing.json` gets a clear chalk-red `Error: <message>` on stderr and exits 1.
- A Trader who runs `folioflow plan garbled.json` (file exists but is not a JSON array) gets a clear chalk-red `Error: Input file is not a JSON array.` on stderr and exits 1.
- A Trader who has not run `folioflow sync-spy` (no `snp500.json` in CWD) and runs `folioflow plan input.json` gets the existing `MissingHoldingsError` rendered in chalk-yellow, consistent with `batch-spy`'s behaviour.
- A Trader who supplies a `top20` option to the library but uses the CLI (no `top20` option) does not see a CLI error — the CLI's `snp500.json` missing case is the canonical path, and the existing batch-spy warning already covers it.

This slice ships no new error class (per the PRD's "no new error class" decision). It uses `MissingHoldingsError` for the holdings case and `FolioFlowError` for the input case.

## Acceptance criteria

- [ ] `cli.runPlan` reads the input file and throws a `FolioFlowError('Input file not found: <path>')` when the path does not exist.
- [ ] `cli.runPlan` reads the input file and throws a `FolioFlowError('Input file is not a JSON array.')` when the file's contents are not a JSON array.
- [ ] `FolioFlow.planPortfolio` (no injection) throws `MissingHoldingsError` with the message `'snp500.json not found. Run syncSPYHoldings() first.'` when `snp500.json` is missing — verified by changing the CWD in the test.
- [ ] `GeneratePortfolioPlan.test.js` extends with a test that a non-array input raises a typed error in the `FolioFlowError` hierarchy.
- [ ] `index.module.test.js` extends with a test that `FolioFlow.planPortfolio` with no `snp500.json` and no `top20` option throws `MissingHoldingsError`.
- [ ] `bin.test.js` extends with a CLI integration test: spawn `node bin/folioflow.js plan nonexistent.json` and assert that the exit code is non-zero and `stderr` contains `Error:` and the path.
- [ ] `bin.test.js` extends with a CLI integration test: spawn `node bin/folioflow.js plan valid-but-empty-array.json` and assert that the run succeeds with `rowCount: 0` and `signalCounts: { buy: 0, sell: 0, hold: 0 }`.
- [ ] All previously-passing tests still pass.

## Blocked by

- `010-plan-core-service-and-cli-render`
