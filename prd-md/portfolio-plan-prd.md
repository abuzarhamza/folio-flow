## Problem Statement

FolioFlow can fetch a Trader's current positions from Robinhood (`dump-rh`) and can rank the S&P 500 by RSI (`rsi` and `batch-spy`), but the Trader has no way to take a *current* portfolio and ask "given today's S&P 500, which of these should I sell, which should I add to, and which are fine as-is?" The Trader has to do this reasoning by hand in a spreadsheet, copying tickers between tools and re-deriving the rules each time.

The Trader wants a single command: hand it a JSON file describing the Trader's current holdings, and get back a JSON file with a buy / sell / hold signal per row plus a short reason string. The reference set is the first 20 tickers in `snp500.json` — a hard-coded "top tier of the S&P 500" — and the rule is intentionally simple: a Symbol not in the top-20 is a candidate buy, a Symbol in the top-20 with negative `Total return` is a candidate sell, everything else is hold.

## Solution

Add a new `plan` subcommand to the CLI and a new `planPortfolio` method to the library. The subcommand takes one positional argument — the path to a JSON file describing the Trader's current portfolio — and writes the augmented plan to `plan.json` in the CWD, mirroring the existing overwrite-on-every-run semantics of `robinhood_portfolio.json` and `spy_rsi_results.json`. The library method takes the same input and returns the augmented array directly.

The decision rule is a pure function of `(symbol, totalReturn, top20Set)`, extracted to a named helper inside the application service so the rule can be tested without any I/O. The top-20 set is read from `snp500.json` in the CWD, matching the existing `batch-spy` pattern. If `snp500.json` is missing, the same `MissingHoldingsError` is raised and the CLI exits 1 with a yellow warning — no special casing, no new error class.

The output preserves every input field on every row, and adds exactly two new fields: `signal` (one of `"buy"`, `"sell"`, `"hold"`) and `reason` (a stable, grep-friendly English string). The reason string is the *only* place the decision logic surfaces to the Trader; changing the rule's reasoning will change the string, so downstream tooling can grep on it.

## User Stories

1. As a Trader, I want to run `folioflow plan my_portfolio.json` and get a JSON plan with a buy/sell/hold signal per row, so that I can decide what to do with each holding without manually comparing tickers to the S&P 500.
2. As a Trader, I want each row in `plan.json` to preserve every field from my input (Name, Symbol, Shares, Price, Average cost, Total return, Equity attribute) plus a new `signal` and `reason`, so that I can sort, filter, and post-process the plan with the same tools I use for any other JSON.
3. As a Trader, I want the top-20 reference set to be the first 20 tickers in `snp500.json`, so that the plan aligns with whatever I already see in the existing `sync-spy` and `batch-spy` outputs.
4. As a Trader, I want the rule to be `buy if Symbol not in top-20; sell if Symbol in top-20 AND Total return < 0; otherwise hold`, so that the plan's reasoning is simple enough to verify by hand and explain in one sentence.
5. As a Trader, I want a status line on stdout summarising the run (`{ status: 'success', rowCount, signalCounts: { buy, sell, hold }, file: 'plan.json' }`), so that I can confirm at a glance how many signals were generated.
6. As a Trader, I want a clear chalk-red error on stderr if my input file is missing, malformed, or doesn't contain an array, so that I can fix the input and re-run without guessing.
7. As a Trader, I want a clear yellow warning on stderr if `snp500.json` is missing, with an instruction to run `folioflow sync-spy` first, so that I can fix the missing file and re-run.
8. As a Trader, I want the `reason` strings to be stable English text I can grep for, so that I can build downstream tools (alerts, dashboards) that match on the reason rather than on the signal alone.
9. As a Node developer, I want `FolioFlow.planPortfolio(rows, options?)` to return the same augmented array the CLI writes, so that I can embed the planning logic in a server or a larger pipeline without parsing CLI output.
10. As a Node developer, I want `FolioFlow.planPortfolio` to accept an explicit `top20` option so I can inject a test set without writing a `snp500.json` to disk, so that the test suite stays fast and offline.
11. As a Node developer, I want `FolioFlow.planPortfolio` to throw a `MissingHoldingsError` when neither `snp500.json` nor a `top20` option is available, so that the failure mode is consistent with `FolioFlow.runBatchRSIs`.
12. As a maintainer, I want the decision rule to live in a single pure function inside the application service, so that the rule can be changed (or extended to per-`Equity attribute` filtering) without touching the file I/O, the CLI, or the library.
13. As a maintainer, I want the application service to have no I/O of its own (no `fs`, no `path`, no `process`), so that it is trivially unit-testable and the I/O concerns stay at the library and CLI edges.
14. As a maintainer, I want the CLI to reuse the existing `prettyJson` and `run`-catch error-rendering helpers, so that the new subcommand is visually and behaviourally consistent with `rsi`, `sync-spy`, `batch-spy`, and `dump-rh`.
15. As a maintainer, I want the input file's 6 fields to be the *only* shape the rule knows about, so that re-shaping `dump-rh` output into the input format is a Trader-side concern (not silently auto-handled by FolioFlow).
16. As a maintainer, I want `plan.json` to be replaced on every run (not appended or merged), so that the file is always a complete snapshot of the latest run, matching the `robinhood_portfolio.json` and `spy_rsi_results.json` semantics.
17. As a Trader, I want the input to be a plain JSON array, not a CSV, so that the file plays well with my existing tooling (jq, Python, etc.) and doesn't require a new parser.
18. As a Trader, I want the field names in the input to be the natural English ones (`Name`, `Symbol`, `Shares`, `Price`, `Average cost`, `Total return`, `Equity attribute`) rather than the snake_case `name`/`symbol`/`quantity`/`current_price`/`average_buy_price`/`unrealised_pl`/`equity_attribute` used by the broker-shaped Position, because my input is *my* portfolio, not a broker's record.
19. As a Trader, I want the output to be the same file regardless of how the input was produced (hand-edited vs. re-shaped from `dump-rh`), so that the planning logic doesn't depend on the input's provenance.
20. As a CI maintainer, I want the new subcommand to be covered by both a unit test (the decision rule) and a CLI integration test (`bin.test.js`), so that CI catches regressions in both the rule and the wiring.

## Implementation Decisions

- **Application service lives at `src/application/GeneratePortfolioPlan.js`.** Constructor takes `(getTop20, options?)`. The `getTop20` is a function that returns the top-20 ticker set; in production it's a closure over `path.join(process.cwd(), 'snp500.json')` + `fs.readFileSync` + `JSON.parse`; in tests it's a jest.fn returning a fixed array. `execute(rows)` is the entry point and has no I/O of its own.
- **The decision rule is a named pure function `decideSignal(row, top20Set)`** exported from `GeneratePortfolioPlan.js`. It takes a single row + the top-20 set and returns `{ signal, reason }`. The function handles all edge cases (missing Symbol, non-numeric Total return, zero Total return) explicitly so tests can drive each branch.
- **Decision rule (canonical):**
  - Symbol missing or non-string → `hold`, reason: `"Symbol is missing or invalid"`.
  - Symbol not in top-20 set → `buy`, reason: `"Symbol is not in the S&P 500 top-20 set (consider buying more)"`.
  - Symbol in top-20 set AND `Total return` < 0 (strictly negative) → `sell`, reason: `"Symbol is in the S&P 500 top-20 set with negative total return (consider selling)"`.
  - Symbol in top-20 set AND `Total return` ≥ 0 (zero or positive) → `hold`, reason: `"Symbol is in the S&P 500 top-20 set with non-negative total return"`.
  - `Total return` is non-numeric (NaN, null, undefined) → treat as 0, which falls into the "non-negative" hold branch.
- **Library surface: `FolioFlow.planPortfolio(rows, options?)`.** The `options.top20` overrides the file read. The `options.getTop20` overrides the default file reader. If neither is supplied and `snp500.json` is missing, throws `MissingHoldingsError`. The method returns the augmented array, preserving every input field on every row plus the two new ones.
- **CLI surface: `folioflow plan <file>`.** The positional `file` is the path to the input JSON. yargs declares it as a required positional. The CLI reads the file, parses it as JSON, calls `FolioFlow.planPortfolio`, writes the augmented array to `plan.json` in the CWD, and prints a status line on stdout: `{ status: 'success', rowCount, signalCounts: { buy, sell, hold }, file: 'plan.json' }`. Errors are caught by `cli.run`'s existing `try/catch` and rendered chalk-red. The `snp500.json` missing case is caught upstream and rendered chalk-yellow (consistent with `batch-spy`).
- **No new domain layer.** This is a pure addition to the existing application/library/CLI layers. The four new glossary entries (`Trader Portfolio`, `Equity Attribute`, `Plan Signal`, `Top-20 Set`) are added inline to `CONTEXT.md` during the design grill and require no new domain code.
- **No new error class.** Missing `snp500.json` reuses `MissingHoldingsError`. Malformed input is a plain `FolioFlowError` (the existing base class; the CLI's catch handles all subclasses generically). Adding a new error class would be over-engineering for two failure modes.
- **`Equity attribute` is recorded in the output but not acted on by the rule in this slice.** The glossary term is locked; future slices can add per-attribute filtering (e.g. "never suggest buying an option"). The rule is intentionally attribute-agnostic for v1 to keep the rule simple and the test surface small.
- **No integration with `dump-rh` in this slice.** The Trader manually re-shapes the `dump-rh` output (or hand-curates) into the 6-field input. A future PRD can add `dump-rh --format=plan-input` if the re-shaping is annoying.
- **Atomic file write for `plan.json`.** Same `writeFileSync` + immediate-commit pattern as `robinhood_portfolio.json` (which is already atomic by virtue of being a single small JSON object — `fs.writeFileSync` is atomic on POSIX for writes under `PIPE_BUF`).

## Testing Decisions

- **What makes a good test for this PRD**: assert on the *observable* behaviour — the output array's shape, the `signal` and `reason` per row, the `plan.json` file's existence and contents, the CLI status line, and the error surfaces. Do not assert on internal method names beyond the public surface.
- **Seam 1 (highest, existing):** `FolioFlow.planPortfolio`. Test by passing an explicit `top20` option (no file I/O). The library's `FolioFlow` is constructed in tests as `new FolioFlow()` with the default adapters — no Robinhood, no Yahoo, no SPY. The plan feature is independent of all three.
- **Seam 2 (new, the decision rule):** the pure function `decideSignal(row, top20Set)` exported from `GeneratePortfolioPlan.js`. Tests cover: in-top-20 + positive → hold; in-top-20 + negative → sell; out-of-top-20 → buy (regardless of return); non-numeric totalReturn → hold; missing Symbol → hold; zero Total return → hold; large negative Total return → sell.
- **Prior art:**
  - `BatchCalculateRSIs.test.js` — mocks the application service collaborators. The pattern for the new `GeneratePortfolioPlan.test.js`.
  - `DumpRobinhoodPortfolio.error-propagation.test.js` — plain object collaborators, no `jest.mock`. The pattern for the `decideSignal` pure-function tests.
  - `bin.test.js` — CLI integration via `child_process.execFileSync`. The pattern for the `plan` CLI integration test.
  - `index.module.test.js` — library surface tests via `FolioFlow` constructor with injected adapters. The pattern for `FolioFlow.planPortfolio` tests.
- **No new test framework, no new assertion library.** Jest only.
- **No new seams** in the infrastructure layer — the feature is pure (no HTTP, no broker, no file-system of its own beyond the `snp500.json` read which goes through the existing `MissingHoldingsError` path).

## Out of Scope

- `dump-rh --format=plan-input` re-shaping (Trader manually re-shapes today; a follow-up PRD can automate this if the friction proves real).
- Configurable top-N (no `--top-n <N>` flag; the rule is fixed at 20).
- Market-cap weighting (would require a new data source; the current `snp500.json` is just a flat list of tickers).
- Per-`Equity attribute` filtering (e.g. "only buy stocks, never etfs"). The glossary has the term; this slice does not act on it.
- Localisation of `reason` strings (English only; the strings are stable for grep-ability).
- A new domain layer.
- A new error class.
- Caching of the top-20 set (read on every call; the file is small).
- A web UI for inspecting the plan (CLI + JSON only).
- A `--format=csv` output mode (JSON only; matches the rest of FolioFlow).
- Streaming / chunked processing of large portfolios (the input is a small JSON array; bounded by Trader discipline).

## Further Notes

- The Trader Portfolio shape (the 6 English-cased fields) is intentionally *different* from the Robinhood Position shape (the 7 snake_cased fields). The glossary has both terms side-by-side; the rules and rationale are in `docs/adr/0007-portfolio-plan.md`.
- The decision rule is a deliberate v1 simplification. Future slices can compose additional rules (RSI bands, drawdown thresholds, sector concentration) on top of the same `decideSignal` helper without changing the I/O surface.
- The `snp500.json` requirement is a hard dependency. A Trader who hasn't run `sync-spy` first will see the same `MissingHoldingsError` they'd see from `batch-spy`. We don't add a "sync for me" step — the existing `batch-spy` doesn't either, and the consistency is worth more than the convenience.
- The 6 input fields map *loosely* to the 7 Robinhood Position fields. The mapping the Trader would do by hand:
  - `Symbol` ← `symbol`
  - `Shares` ← `quantity`
  - `Price` ← `current_price`
  - `Average cost` ← `average_buy_price`
  - `Total return` ← `unrealised_pl` (dollars; we don't use `unrealised_pl_pct` because the rule is dollar-denominated)
  - `Name` ← (hand-curated, not in the Robinhood shape)
  - `Equity attribute` ← (hand-curated, not in the Robinhood shape)
- The `Equity attribute` term is in the glossary but the v1 rule does not consume it. This is intentional: adding per-attribute filtering is a follow-up slice that should be designed in its own grill, not bolted on here.
- The `docs/adr/0007-portfolio-plan.md` captures the rationale for the locked design (top-20 set as first-20, English-cased field names, no integration with `dump-rh`).
