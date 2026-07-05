---
title: "plan: core service, decision rule, library wiring, CLI render"
status: ready
blocked_by: []
parent: prd-md/portfolio-plan-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/portfolio-plan-prd.md`

## What to build

A vertical slice that introduces the `plan` end-to-end happy path. After this slice:

- `src/application/GeneratePortfolioPlan.js` exists with a `decideSignal(row, top20Set)` pure function and a `GeneratePortfolioPlan` class with `execute(rows)` that returns the augmented array.
- `FolioFlow.planPortfolio(rows, options?)` exists, returns the augmented array, and accepts `{ top20, getTop20 }` injection points. Throws `MissingHoldingsError` if neither `snp500.json` nor an injection is available.
- `cli.runPlan(argv, options?)` exists, reads the input file, calls `FolioFlow.planPortfolio`, writes `plan.json` in the CWD, and prints the status line on stdout.
- The CLI's `run` switch handles `plan` and forwards to `runPlan`.
- The input is parsed as a JSON array; rows are passed through unchanged except for the new `signal` and `reason` fields.
- The output is the input array superset with `signal` and `reason` per row; the file is replaced on every run.

The slice is fully testable offline: the application service's `decideSignal` is a pure function, `FolioFlow.planPortfolio` accepts an explicit `top20` option, and the CLI integration test passes an input file in a tmp dir.

## Acceptance criteria

- [ ] `src/application/GeneratePortfolioPlan.js` exports `decideSignal(row, top20Set)` and the `GeneratePortfolioPlan` class.
- [ ] `decideSignal` is a pure function with no I/O and no hidden state.
- [ ] `decideSignal` returns `{ signal: 'hold', reason: 'Symbol is missing or invalid' }` when `row.Symbol` is missing or non-string.
- [ ] `decideSignal` returns `{ signal: 'buy', reason: 'Symbol is not in the S&P 500 top-20 set (consider buying more)' }` when the symbol is not in the top-20 set.
- [ ] `decideSignal` returns `{ signal: 'sell', reason: 'Symbol is in the S&P 500 top-20 set with negative total return (consider selling)' }` when the symbol is in the top-20 set and `Total return` is strictly negative.
- [ ] `decideSignal` returns `{ signal: 'hold', reason: 'Symbol is in the S&P 500 top-20 set with non-negative total return' }` when the symbol is in the top-20 set and `Total return` is zero, positive, or non-numeric.
- [ ] `GeneratePortfolioPlan.execute(rows)` returns an array where every input row is preserved exactly and a `signal` and `reason` field is attached to each.
- [ ] `FolioFlow.planPortfolio(rows, options)` returns the same array the application service produces.
- [ ] `FolioFlow.planPortfolio(rows, { top20: ['AAPL', ...] })` does not read `snp500.json`.
- [ ] `FolioFlow.planPortfolio(rows)` (no injection) throws `MissingHoldingsError` when `snp500.json` is missing in the CWD.
- [ ] `cli.runPlan({ _: ['plan', 'input.json'] }, options)` reads the file, calls `planPortfolio`, writes `plan.json`, and prints `{ status: 'success', rowCount, signalCounts: { buy, sell, hold }, file: 'plan.json' }` on stdout.
- [ ] `cli.run` switch has a `case 'plan':` that calls `runPlan(argv)`.
- [ ] `GeneratePortfolioPlan.test.js` covers the seven `decideSignal` cases listed above plus one `execute` round-trip test.
- [ ] `index.module.test.js` extends with one `FolioFlow.planPortfolio` happy-path test.
- [ ] No production code reaches the network. No new dependencies.
- [ ] All previously-passing tests still pass.

## Blocked by

None — can start immediately.
