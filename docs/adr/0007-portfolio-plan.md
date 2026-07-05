# ADR-0007: Portfolio plan subcommand (`plan`)

- Status: Accepted
- Date: 2026-07-02
- Context: FolioFlow — new `plan` subcommand

## Context

FolioFlow can fetch a Trader's current positions from Robinhood (`dump-rh`) and rank the S&P 500 by RSI (`rsi` and `batch-spy`), but the Trader has no way to take a *current* portfolio and ask "given today's S&P 500, which of these should I sell, which should I add to, and which are fine as-is?" The Trader wants a single command: take a JSON file describing the Trader's current holdings, return a JSON file with a buy / sell / hold signal per row plus a short reason string. The reference set is the first 20 tickers in `snp500.json` (the existing S&P 500 constituent list), and the rule is intentionally simple: a Symbol not in the top-20 is a candidate buy, a Symbol in the top-20 with negative `Total return` is a candidate sell, everything else is hold.

## Decision

Add a new `plan` subcommand and a new `FolioFlow.planPortfolio` library method. The CLI takes a positional `<file>` argument pointing to a JSON array describing the Trader's portfolio, augments each row with a `signal` and a `reason`, and writes the result to `plan.json` in the CWD (replacing the file on every run, mirroring `robinhood_portfolio.json` and `spy_rsi_results.json`).

### Input shape (the Trader Portfolio)

A plain JSON array of objects. The Trader Portfolio is *deliberately* a separate glossary term from the existing `Position` (the broker-shaped Robinhood record). The 6+1 fields, with the canonical English-cased names, are:

| Field             | Type   | Description                                                                 |
| ----------------- | ------ | --------------------------------------------------------------------------- |
| `Name`            | string | Instrument display name (e.g. `"Apple Inc."`).                              |
| `Symbol`          | string | Ticker (e.g. `"AAPL"`).                                                     |
| `Shares`          | number | Quantity held.                                                              |
| `Price`           | number | Current market price.                                                       |
| `Average cost`    | number | Cost basis per share.                                                       |
| `Total return`    | number | Realised + unrealised P/L in dollars.                                       |
| `Equity attribute`| string | Type tag — e.g. `"stock"`, `"etf"`, `"option"`, `"crypto"`. **Not** consumed by the v1 rule, but recorded in the output for future use. |

### Output shape

The input array superset. Every input field is preserved on every row, and two new fields are attached:

```json
{
    "Name": "Apple Inc.",
    "Symbol": "AAPL",
    "Shares": 12,
    "Price": 191.05,
    "Average cost": 178.42,
    "Total return": 151.56,
    "Equity attribute": "stock",
    "signal": "hold",
    "reason": "Symbol is in the S&P 500 top-20 set with non-negative total return"
}
```

### Decision rule (canonical, v1)

| Condition                                              | Signal  | Reason (stable English string)                                              |
| ------------------------------------------------------ | ------- | --------------------------------------------------------------------------- |
| `Symbol` is missing or not a string                    | `hold`  | `Symbol is missing or invalid`                                              |
| `Symbol` is not in the top-20 set                      | `buy`   | `Symbol is not in the S&P 500 top-20 set (consider buying more)`            |
| `Symbol` is in the top-20 set AND `Total return` < 0   | `sell`  | `Symbol is in the S&P 500 top-20 set with negative total return (consider selling)` |
| `Symbol` is in the top-20 set AND `Total return` ≥ 0   | `hold`  | `Symbol is in the S&P 500 top-20 set with non-negative total return`        |
| `Total return` is non-numeric (NaN, null, undefined)   | `hold`  | (Same as the ≥ 0 case — treated as 0.)                                       |

The rule is a pure function `decideSignal(row, top20Set)` exported from `src/application/GeneratePortfolioPlan.js`. The application service has no I/O of its own; the file read happens in `FolioFlow.planPortfolio`.

### Key shape decisions

- **Top-20 source: `snp500.json`'s first 20 entries.** Match the existing `batch-spy` pattern (`path.join(process.cwd(), 'snp500.json')` and `MissingHoldingsError` on missing). The application service accepts a `getTop20` injection point so tests can pass a fixed array.
- **English-cased field names** (`Name`, `Symbol`, `Shares`, `Price`, `Average cost`, `Total return`, `Equity attribute`) — not snake_case. The input is the Trader's portfolio, not a broker's record; the Trader's mental model uses English-cased labels.
- **Stable reason strings.** The reason text is the only surface for the decision logic; downstream tooling can grep on it. Localisation and templating are out of scope.
- **Output preserves every input field.** The output is the input superset, not a transformed record. This keeps the file usable in jq, Python, and the Trader's other tooling.
- **No new error class.** Missing `snp500.json` reuses `MissingHoldingsError`. Malformed input is a plain `FolioFlowError` (the CLI's catch handles all subclasses generically).
- **No integration with `dump-rh` in this slice.** The Trader manually re-shapes the Robinhood Position shape (7 snake_cased fields) into the Trader Portfolio shape (6 English-cased fields) by hand. The mapping is documented in the PRD's "Further Notes" section. A follow-up PRD can add `dump-rh --format=plan-input` if the re-shaping proves annoying in practice.
- **`Equity attribute` is recorded but not consumed.** The v1 rule is attribute-agnostic. Adding per-attribute filtering (e.g. "never suggest buying an option") is a follow-up slice that should be designed in its own grill, not bolted on here.
- **Atomic file write for `plan.json`.** Same `writeFileSync` pattern as `spy_rsi_results.json` — atomic on POSIX for small JSON writes.

## Consequences

Positive:
- The Trader gets a one-line answer to "what should I do with each holding?" with stable, greppable reasoning.
- The decision rule is a single pure function — easy to change, easy to test, easy to extend (future rules like RSI bands or drawdown thresholds can compose on top of `decideSignal`).
- The application service has no I/O, which means the library and CLI can wrap it without testability concerns.
- The input is plain JSON, not CSV — plays well with the Trader's existing tooling (jq, Python, spreadsheets).

Negative / acknowledged risks:
- **English-only reason strings.** A future Trader who speaks another language can't read the output without translation. This is acceptable for v1 (the project has no other localisation work) and can be revisited if real demand appears.
- **`Equity attribute` is recorded but ignored.** This is intentional for v1 but feels wasteful. The justification is that the v1 rule is simple and the test surface is small; adding attribute filtering would multiply the test cases by the number of attributes without changing the core decision logic. Future slice will add filtering.
- **The 20-ticker hard cap is not configurable.** A Trader with 30 holdings will see 30 buy signals if none of their symbols are in the top-20. This is correct (none of their holdings are top-tier S&P 500 names) but might be surprising. A `--top-n <N>` flag is a future-PR; v1 keeps the rule simple.
- **No integration with `dump-rh` in this slice.** The Trader has to re-shape the output by hand. The shape mapping is small (6 fields → 7 fields, English to snake_case) but it's still manual friction. A `dump-rh --format=plan-input` flag is the natural follow-up.
- **The rule is dollar-denominated, not percentage-denominated.** A $1,000 loss on a $100,000 position (1%) and a $1,000 loss on a $2,000 position (50%) both trigger the sell signal. This is intentional — the Trader Portfolio's `Total return` is in dollars, and the rule uses the field as-is. A percentage-based rule would need either a derived field or a different input shape.
- **The first-20 in `snp500.json` is whatever order State Street publishes.** There's no market-cap weighting, alphabetical sorting, or any other ordering guarantee. A Trader who wants weighted top-20 needs a different data source.

## Alternatives considered

- **CSV input.** Rejected. The Trader's tooling (jq, Python) handles JSON better than CSV; CSV would require a new parser; and the field names with spaces (`Average cost`, `Total return`) are awkward in CSV.
- **Snake_case field names (`name`, `symbol`, `quantity`, `current_price`, `average_buy_price`, `unrealised_pl`, `equity_attribute`).** Rejected. The input is the Trader's portfolio, not a broker's record; matching the Robinhood Position field names would conflate two glossary terms and force the Trader to use the broker's mental model. The English-cased names are deliberately different.
- **Auto-re-shape `dump-rh` output into the input format.** Deferred to a follow-up. Doing it in v1 would couple the new subcommand to Robinhood; the Trader's portfolio may come from any source (hand-curated spreadsheet, a different broker, a tax statement). Keeping the input shape independent is the right call.
- **Per-`Equity attribute` filtering in v1.** Rejected. Adds combinatorial test cases without changing the core decision. Deferred to a follow-up PRD that can also redesign the rule if needed.
- **Configurable top-N (`--top-n 30`).** Deferred. The 20 cap is intentional and the rule's reasoning depends on it. A future flag would need a new reason-string for "out of top-30" vs "out of top-20", which is busywork without a Trader asking for it.
- **A new error class for malformed input.** Rejected. `FolioFlowError` is the base class; the CLI's catch handles all subclasses generically. Adding `PlanInputError extends FolioFlowError` adds surface without value.
- **A new domain layer for the plan concept.** Rejected. The plan feature has one service (`GeneratePortfolioPlan`), one decision rule, and one CLI subcommand. A domain layer would be a single class for a single concept — over-engineered.
- **Market-cap-weighted top-20.** Rejected. Requires a new data source. The existing `snp500.json` is a flat list of tickers in State Street's publication order, with no weights. Adding a market-cap source is a separate PRD.
- **Localisation of reason strings.** Rejected. The strings are stable for grep-ability. Localisation is a separate concern with its own infrastructure (message catalogues, locale detection) that this project doesn't have.
doesn't have.
