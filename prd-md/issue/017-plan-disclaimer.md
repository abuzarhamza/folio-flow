---
title: "plan: 'not investment advice' disclaimer across README, NOTICE, and CLI stderr"
status: done
blocked_by: []
parent: prd-md/plan-disclaimer-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/plan-disclaimer-prd.md`

## What to build

A thin docs-and-stderr slice that surfaces a "not investment advice" disclaimer at the four moments a Trader might act on a `folioflow plan` signal. The slice is provably a presentation-layer concern: no change to the decision rule, the input shape, `CONTEXT.md`, or any ADR. The four surfaces (project-wide README blockquote, `### 4. Portfolio Plan` README blockquote, sibling `docs/example-portfolio.NOTICE.txt`, chalk-yellow CLI stderr line) are not independently shippable — a partial ship leaves the README pointing at a NOTICE that doesn't exist, or a CLI line the README doesn't acknowledge. They ship together.

A Trader who runs `folioflow plan my_portfolio.json` after this slice lands sees a chalk-yellow warning on stderr, the JSON status line on stdout, and three places in the README (and one in the worked-example's `cp` block) that all say the same thing: this is a mechanical rule, not advice.

## Acceptance criteria

- [ ] A new one-line blockquote appears in `README.md` under the H1 heading and before the `## Features` section, framing FolioFlow as a mechanical analysis tool that does not provide financial advice.
- [ ] A new two-sentence blockquote appears in `README.md` at the top of the `### 4. Portfolio Plan` section, immediately under the H3 and before the `Rule (v1)` bullets, stating that plan signals are a mechanical rule, not financial advice, and that the Trader should consult a licensed advisor before acting on them.
- [ ] A new file `docs/example-portfolio.NOTICE.txt` exists with the same two-sentence text as the `### 4. Portfolio Plan` blockquote, as a single line of plain text.
- [ ] The README's `cp docs/example-portfolio.json my_portfolio.json` block is extended to also copy the NOTICE file alongside, with a one-line comment that the Trader should read the NOTICE first.
- [ ] The `folioflow plan` subcommand emits the disclaimer to stderr in chalk-yellow, exactly once per run, immediately before the JSON status line on stdout. The wording matches the `### 4. Portfolio Plan` blockquote.
- [ ] The disclaimer string is defined once in the CLI module (a single top-of-file constant) and used by the `runPlan` function. The string is not duplicated across the README, NOTICE.txt, and CLI by hand — the README and NOTICE.txt ship the same text in two places, by design, but the CLI uses the module constant.
- [ ] A new `it` block in `bin.test.js` runs `folioflow plan valid-but-empty-array.json` via the existing `runBin` helper and asserts `result.stderr` matches `/not financial advice/`. The existing `FORCE_COLOR: '0'` setting strips the chalk color, so the test asserts on plain text.
- [ ] `docs/example-portfolio.json` is unchanged (still pure JSON, still 4 rows, still the canonical 6+1 input keys, still no `signal` or `reason` in the input).
- [ ] `CONTEXT.md` is unchanged. No new ADR is created. `src/application/GeneratePortfolioPlan.js` is unchanged. `FolioFlow.planPortfolio` is unchanged. `package.json` `files` is unchanged (the NOTICE.txt is in `docs/` and is not shipped with the npm package; the README blockquote and the CLI stderr line are sufficient for the npm-installed Trader).
- [ ] `npm test` passes with no skipped or failing tests.

## Blocked by

None - can start immediately
