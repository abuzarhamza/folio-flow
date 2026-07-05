---
title: "plan: worked example file, README block, --help pointer, smoke test"
status: done
blocked_by: []
parent: prd-md/plan-example-file-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/plan-example-file-prd.md`

## What to build

A thin docs-and-test slice that ships a 4-row worked example for `folioflow plan <file>`. The slice delivers one artifact (a JSON file in the repo), one user-facing surface (a fenced JSON block in the README + a `cp` command), one CLI surface (a one-line pointer in `folioflow plan --help`), one packaging change (the file ships with the npm package), and one smoke test (the file is parseable and matches the 6+1 canonical input field set).

A Trader who has never run `folioflow plan` can now copy the example, edit their real holdings into it, and run the command — without first reading ADR-0007.

## Acceptance criteria

- [ ] A new file `docs/example-portfolio.json` exists, parses as a JSON array of length 4, and every row contains exactly the 6+1 canonical input keys: `Name`, `Symbol`, `Shares`, `Price`, `Average cost`, `Total return`, `Equity attribute`. No row contains `signal` or `reason` (those are output, not input).
- [ ] The four rows cover the three signal branches: at least one row whose Symbol is in the S&P 500 top-20 with non-negative `Total return` (→ `hold`), at least one row whose Symbol is in the top-20 with negative `Total return` (→ `sell`), and at least one row whose Symbol is not in the top-20 (→ `buy`).
- [ ] The `Equity attribute` field uses `stock` on at least three rows and a non-`stock` value (`etf`) on at least one row, demonstrating the field's value space without over-claiming the v1 rule's behavior.
- [ ] The `README.md` "Portfolio Plan" section contains the same 4-row content as a fenced JSON block, byte-identical to `docs/example-portfolio.json`. The section also documents a one-line `cp docs/example-portfolio.json my_portfolio.json` command and a one-line caveat that the prices and returns are realistic-but-not-real-time.
- [ ] The `folioflow plan <file>` command's `describe` text in `bin/folioflow.js` includes the line `See docs/example-portfolio.json for a worked example.`, so the pointer appears in `folioflow plan --help` output.
- [ ] `package.json`'s `files` array includes `docs/example-portfolio.json` (or a directory pattern that covers it), so the file ships with `npm install` and `npm install -g`.
- [ ] A new test in `src/application/GeneratePortfolioPlan.test.js` loads `docs/example-portfolio.json` from disk and asserts: it parses to an array of length 4, every row has the 6+1 canonical keys, every numeric field is a number, every `Symbol` is a non-empty string, and no row contains `signal` or `reason`.
- [ ] `npm test` passes with no skipped or failing tests.
- [ ] No change to `CONTEXT.md`, no new ADR, no new domain layer, no change to the decision rule, no change to the `plan` CLI's argument handling.

## Blocked by

None - can start immediately
