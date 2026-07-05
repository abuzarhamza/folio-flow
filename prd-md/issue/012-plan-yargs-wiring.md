---
title: "plan: yargs declaration and CLI discoverability"
status: ready
blocked_by:
  - 010-plan-core-service-and-cli-render
parent: prd-md/portfolio-plan-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/portfolio-plan-prd.md`

## What to build

A vertical slice that wires the `plan` subcommand into yargs and makes it discoverable via `folioflow --help`. After this slice:

- `folioflow --help` lists `plan <file>` alongside `rsi`, `sync-spy`, `batch-spy`, and `dump-rh`.
- yargs requires exactly one positional argument (the input file path).
- `folioflow plan` (no file) exits non-zero with a yargs usage error.
- `folioflow plan <file>` runs the existing `cli.runPlan` (no behaviour change from slice 010).

The slice is thin and the acceptance criteria are mostly about discoverability and the yargs contract, not new behaviour. The slice exists separately because it is the only place that touches `bin/folioflow.js` (the yargs declaration file), and a follow-up grader should be able to review the yargs changes in isolation.

## Acceptance criteria

- [ ] `bin/folioflow.js` adds a yargs `command('plan <file>', ...)` declaration with a `chalk.cyan` description and a `positional('file', { type: 'string', describe: 'Path to a Trader Portfolio JSON file' })`.
- [ ] `folioflow --help` output includes `plan <file>` and the description.
- [ ] `folioflow plan` (no positional) exits non-zero with a yargs usage error (the default yargs behaviour, no new code needed beyond the declaration).
- [ ] `folioflow plan <existing-file>` runs `cli.runPlan(argv)` and produces the same status line and `plan.json` as in slice 010.
- [ ] `bin.test.js` extends with a test: `folioflow --help` output includes `plan <file>`.
- [ ] All previously-passing tests still pass.

## Blocked by

- `010-plan-core-service-and-cli-render`
