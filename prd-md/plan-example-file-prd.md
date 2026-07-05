# PRD: Worked example for `folioflow plan <file>`

> Synthesised from the `/grill-with-doc` session on 2026-07-05. See `CONTEXT.md` for the ubiquitous language, ADR-0007 for the `plan` subcommand's design, and the `portfolio-plan-prd.md` PRD for the original `plan` slice. Triage label requested: `ready-for-agent`.

## Problem Statement

`folioflow plan <file>` exists and works, but a Trader who has never run it has no obvious starting point. The README documents the input shape as a fenced JSON block with a single AAPL row, which is enough to teach the field names but not enough to teach the *behavior*: that the `signal` field is one of `buy` / `sell` / `hold`, that the `reason` is a stable English string, and that the rule branches on membership in the S&P 500 top-20 set and the sign of `Total return`.

The Trader who reaches for the tool has to either (a) hand-craft a portfolio from scratch and hope the field names match the canonical 6+1, or (b) read ADR-0007 end-to-end to find the rule and the shape. Both are friction. A worked example, shippable as a file in the repo, collapses both into `cp docs/example-portfolio.json my_portfolio.json && folioflow plan my_portfolio.json`.

The Robinhood removal (`prd-md/remove-robinhood-prd.md`, ADR-0008) left the `plan` subcommand's documentation in a thin state: the "Input Shape" block in README is the only worked example, and it has exactly one row. A multi-row example is overdue.

## Solution

Ship a 4-row worked example as a JSON file in the repo, inline the same content as a fenced block in the README, and surface a one-line pointer in the `folioflow plan --help` description. The example uses real S&P 500 tickers so a Trader who runs it today against their existing `snp500.json` actually sees the rule fire on all three signals (one `buy`, one `sell`, two `hold`). The Trader copies the file, edits their real holdings into it, and runs `folioflow plan`.

The example is documentation, not a new code path. No new flag, no new test seam, no new domain layer. The single new code surface is a smoke test in the existing `src/application/GeneratePortfolioPlan.test.js` that loads the file and asserts its shape — cheap insurance against the README and the file drifting out of sync.

## User Stories

1. As a Trader, I want a worked example file in the repo, so that I can `cp` it and have a valid starting point for my own portfolio without hand-typing the 6+1 canonical fields.
2. As a Trader, I want the example to contain real S&P 500 tickers with realistic numeric values, so that I can run `folioflow plan` against my existing `snp500.json` and see the rule fire on `buy`, `sell`, and `hold` in a single run.
3. As a Trader, I want the example to use the exact 6+1 input field set (`Name`, `Symbol`, `Shares`, `Price`, `Average cost`, `Total return`, `Equity attribute`) with no pre-populated `signal` or `reason`, so that I see the *input* shape clearly and the rule's *output* as a separate, generated layer.
4. As a Trader, I want the example to be inlined as a fenced JSON block in the README, so that I can read the shape without leaving GitHub or the npm package.
5. As a Trader, I want `folioflow plan --help` to mention the example file path, so that I find the example from the CLI itself, not only from the README.
6. As a Trader, I want the example file to be shipped in the npm package (not only in the git repo), so that an `npm install -g folioflow` user can find it via the same `--help` pointer.
7. As a maintainer, I want a smoke test that loads the example file and asserts the 6+1 canonical field set on every row, so that a future change to the input shape that drifts from ADR-0007 fails CI before it ships.
8. As a maintainer, I want the example file's contents and the README's fenced block to be byte-identical, so that there is one source of truth and the Trader sees the same thing in both places.
9. As a maintainer, I want no new code path, no new flag, and no new test seam beyond the existing application-layer unit-test file, so that this slice is a docs change with one smoke test, not a feature.
10. As a maintainer, I want the example to be small enough to read at a glance (4 rows, ~600 bytes), so that it stays a teaching artifact and not a stress test.

## Implementation Decisions

- **Example file path: `docs/example-portfolio.json`.** Sits next to the ADRs in `docs/`, which a Trader pointed at from `--help` is already navigating. `package.json`'s `files` array is extended to ship the file with the npm package.
- **Row count: 4.** Two `hold`, one `sell`, one `buy`. The `hold` rows make it clear that `hold` is the modal outcome (most holdings in the top-20 have non-negative returns), and the single `sell` and `buy` rows each document one branch of the rule.
- **Ticker selection: AAPL, MSFT, GOOGL, BURL.** AAPL / MSFT / GOOGL are reliably in the first 20 of State Street's published S&P 500 list (the source of `snp500.json`). BURL (Burlington Stores) is in the S&P 500 but well outside the top-20, which is what fires the `buy` branch. All four are real, tradeable, and easily verifiable by the Trader.
- **Numeric values are realistic but not the live market.** Prices and returns are plausible 2026-era values; they are not real-time quotes. The example is a teaching artifact about the *shape*, not a signal about any specific holding. The README makes this explicit in a one-line caveat.
- **`Equity attribute` values: 3 × `stock`, 1 × `etf`.** The `etf` row (BURL is the natural choice) demonstrates that the field is a free-form string the Trader can fill in, without over-claiming that the v1 rule uses the field for anything. ADR-0007 records the v1 rule as attribute-agnostic.
- **The example is the input only.** No pre-populated `signal` or `reason` fields. The Trader sees the input shape clearly; the rule's output is what they get when they run `folioflow plan`.
- **README inline block is byte-identical to the file.** A single source of truth, copy-pasted into both places. The README points at the file path with a `cp` command for the Trader who wants to start editing.
- **`folioflow plan --help` description gains a one-line pointer** in `bin/folioflow.js`. The pointer is part of the command's `describe` text so it appears inline with the rest of the command help, not as a separate yargs epilogue. The pointer is `See docs/example-portfolio.json for a worked example.` — a single line, no extra yargs machinery.
- **`package.json` `files` array extends to include `docs/example-portfolio.json`.** This is the only `package.json` change. The file ships with both `npm install` and `npm install -g`, so a Trader who installs the package and runs `folioflow plan --help` finds a path that exists on their filesystem.
- **No new ADR.** This is a docs-and-example change. The input shape and the rule are already pinned in ADR-0007; the example is an instance of that shape. Recording "we shipped a worked example" would be noise.
- **No change to `CONTEXT.md`.** The example is an instance of the existing `Trader Portfolio` glossary term, not a new concept. No new vocabulary.

## Testing Decisions

- **Smoke test: one new `it` block in `src/application/GeneratePortfolioPlan.test.js`.** The test:
  1. Loads `docs/example-portfolio.json` from disk.
  2. Asserts it parses to a JSON array of length 4.
  3. Asserts every row contains the 6+1 canonical keys: `Name`, `Symbol`, `Shares`, `Price`, `Average cost`, `Total return`, `Equity attribute`.
  4. Asserts each `Symbol` is a non-empty string and each numeric field is a number.
  5. Asserts no row contains `signal` or `reason` (those are output, not input).
- **What makes a good test for this slice:** asserts the *external* contract (the file is parseable, the shape matches ADR-0007, the input is the input) — not the *internal* details of the rule. The rule itself is already covered by the existing `decideSignal` unit tests, which use inline fixtures, not the example file.
- **Prior art for the test pattern:** the existing `src/application/GeneratePortfolioPlan.test.js` file already uses inline `jest.isolateModules` fixtures. The smoke test follows the same style — `describe` block, `it` per assertion category, no module mocking, no CLI spawning.
- **Out of scope for testing:** running `folioflow plan docs/example-portfolio.json` end-to-end. That requires a `snp500.json` fixture, which the test suite currently mocks away. The smoke test gives us the same drift protection at a fraction of the surface.
- **Out of scope for testing:** asserting the byte-identity between the file and the README's fenced block. A `git diff` will surface that in PR review, and the cost of a programmatic assertion (parsing the README, slicing out the code block, comparing) outweighs the benefit.

## Out of Scope

- Generating a Trader Portfolio from a broker. ADR-0007 deliberately decouples `plan` from any broker; this slice respects that. A future broker-specific integration (Alpaca, Schwab) would be a separate ADR.
- Adding a `--init` flag to `folioflow plan` that writes a starter file. The example file *is* the starter; a flag duplicates the surface.
- Adding the example to a test fixture directory under `src/application/__fixtures__/`. The example is a Trader-facing artifact, not a test artifact. The smoke test loads it directly from `docs/`, not from a fixture path.
- Modifying the decision rule, the input field set, or the CLI command. The example matches what already exists.
- Translating the example to multiple languages. Out of scope for v1; the project has no localisation infrastructure.
- A `--validate` flag that dry-runs the example. The Trader's `folioflow plan docs/example-portfolio.json` *is* the validation; the smoke test covers the offline case.

## Further Notes

- **Why no new domain layer:** the example is a `Trader Portfolio` (already a glossary term), with realistic field values. The rule treats the example exactly as it treats any Trader input. The example does not need a new vocabulary term; it is an instance of an existing one.
- **Why no new ADR:** ADR-0007 already pins the input shape and the rule. The example is the smallest possible instance of the input shape. An ADR for a worked example would be a `0009-shipped-a-json-file.md` and would be noise.
- **Why the smoke test is in `GeneratePortfolioPlan.test.js`:** the test asserts that the file conforms to the contract that the application service consumes. Putting the test anywhere else (e.g. a new `docs/example-portfolio.test.js`) would split the contract assertion from the consumer. A maintainer who changes the input field set in ADR-0007 will look at the test next to the application service first; that is the right place to find a drift alarm.
- **Why the `BURL` ticker:** ADR-0007's rule uses the first 20 of `snp500.json`, in State Street's publication order. AAPL / MSFT / GOOGL are reliably in the top 10. BURL is in the S&P 500 but at a much lower position, which is what fires the `buy` branch. Using a fake ticker (e.g. `ZZZZZ`) would teach the Trader the wrong thing — that the rule fires on the absence of a ticker rather than on its position in the S&P 500. A real-but-non-top-20 ticker is honest about what the rule does.
- **Why a single worked example, not multiple:** a Trader reading the example should be able to see the entire input shape in one screen. Four rows is enough to demonstrate all three signals. More rows would be a stress test, not a teaching artifact, and would clutter the README.
- **The Trader's workflow after this ships:** `cp docs/example-portfolio.json my_portfolio.json` → edit the four rows to the Trader's real holdings → `folioflow sync-spy` (if they haven't already) → `folioflow plan my_portfolio.json` → read `plan.json`. The README's `### 4. Portfolio Plan` section will document this sequence inline with the example block.
