# CONTEXT

Ubiquitous language for the FolioFlow module. This file is a glossary only — no implementation details, no specs.

## Actors

- **Trader** — A person running FolioFlow from the CLI to evaluate momentum for one or more symbols. They are the source of all `Symbol` input.
- **Integrator** — A developer consuming FolioFlow as a Node module, or piping its JSON output into downstream bots or analytical scripts. They care about the strictness of the output schema.

## Core concepts

- **Symbol** — A stock ticker string (e.g. `AAPL`) supplied by the Trader. The smallest unit the Trader can ask the system to evaluate.
- **Historical Prices** — A chronologically ordered series of daily closing prices for a Symbol, fetched from an external data provider. Used as the raw input to every RSI calculation.
- **RSI (Relative Strength Index)** — A bounded momentum indicator in the range `[0, 100]` derived from Historical Prices over a fixed look-back Period. FolioFlow only ever reports the *current* (most recent) RSI value, never the whole series.
- **Period** — The integer look-back length (number of trading days) used to compute one RSI. FolioFlow computes three Periods: **22, 44, 66**.
- **RSI Result** — The composite output for a single Symbol. Contains the Symbol, a `generated_at` ISO 8601 timestamp marking the moment the result was produced, the current RSI for each configured Period, the average of those current values, and one Window Descriptor per Period. Shape (canonical, exactly as emitted on stdout and on every row of `spy_rsi_results.json`):
  ```json
  {
    "generated_at": "2026-07-08T23:37:25.044Z",
    "symbol": "AAPL",
    "rsi_22": 53.82,
    "rsi_44": 55.67,
    "rsi_66": 55.95,
    "rsi_avg": 55.15,
    "rsi_22_window": { "start_date": "2025-09-12", "end_date": "2026-07-08" },
    "rsi_44_window": { "start_date": "2025-08-21", "end_date": "2026-07-08" },
    "rsi_66_window": { "start_date": "2025-07-30", "end_date": "2026-07-08" }
  }
  ```
- **RSI Average** — The arithmetic mean of the three configured RSI values for a Symbol. Reported by both the CLI and the library API. Falls back to the mean of *available* values when one or more periods lack enough history.
- **Window Descriptor** — A `{start_date, end_date}` pair attached to a Period, describing the span of bars that contributed to the emitted RSI. `start_date` is the date of the first bar on which the Period's RSI was computable (Wilder's warm-up = `period` bars from the start of the series). `end_date` is the date of the most recent bar in the series. `null` when the Period has no computable values (e.g. a stock younger than 22 trading days).
- **SPY Holdings** — The set of Symbols that make up the S&P 500 index, as published by State Street in their official `.xlsx` spreadsheet. Treats as the canonical constituency list at sync time.
- **Holdings Sync** — The act of fetching SPY Holdings from the State Street spreadsheet and persisting the Symbol list to `snp500.json` in the current working directory.
- **Batch Run** — A sequential calculation of the RSI Result for every Symbol previously captured in `snp500.json`. Outputs to `spy_rsi_results.json`.
- **Rate-Limited Window** — A fixed inter-request delay inserted between every fetch in a Batch Run. Exists to keep the system below the provider's per-IP request threshold; it is a domain constraint, not an implementation detail.

## Application services (use cases)

- **GetStockRSIs** — Given one Symbol, return that Symbol's RSI Result. Always fetches its own Historical Prices.
- **SyncSPYHoldings** — Refresh `snp500.json` from the current SPY Holdings.
- **BatchCalculateRSIs** — Given a list of Symbols, return an RSI Result for each in order, applying the Rate-Limited Window between fetches.

## Bounded contexts

This module is a single bounded context. The four internal layers (Presentation, Application, Infrastructure, Domain) are architectural organisation, **not separate subdomains** — they share this one ubiquitous language and one RSI Result shape.

## External terms we consume (not ours)

- **S&P 500** — The index whose constituents become SPY Holdings at sync time.
- **Yahoo Finance** — The external data provider for Historical Prices. Adapter-wrapped; the domain does not name it.
- **State Street** — The publisher of the SPY Holdings spreadsheet. Adapter-wrapped; the domain does not name it.
- **Wilder's smoothing** — The smoothing method the upstream `technicalindicators` library uses for RSI. We do not redefine it; we consume it as-is.

## Trader Portfolio

- **Trader Portfolio** — A JSON document the Trader provides to FolioFlow describing their own current holdings, independent of any broker. One object per holding. Carries the six canonical fields (Name, Symbol, Shares, Price, Average cost, Total return, Equity attribute). May be hand-edited by the Trader.
- **Equity Attribute** — A user-supplied tag on a Trader Portfolio row classifying the instrument by type (e.g. `stock`, `etf`, `option`, `crypto`). The `plan` subcommand can use this to filter buy/sell signals by type.
- **Plan Signal** — A buy, sell, or hold verdict produced for one row of a Trader Portfolio. Computed by the `plan` subcommand against the S&P 500 top-20 set; each signal carries a `reason` string explaining the verdict.
- **Top-20 Set** — The first 20 tickers in `snp500.json` (the S&P 500 constituent list, ordered as State Street publishes them). Used by `plan` as the reference set for "is this holding a top-tier S&P 500 name?". A holding *not* in the top-20 set is a candidate buy; a holding *in* the top-20 set with negative `Total return` is a candidate sell.

## Application services (use cases)

- **GetStockRSIs** — Given one Symbol, return that Symbol's RSI Result. Always fetches its own Historical Prices.
- **SyncSPYHoldings** — Refresh `snp500.json` from the current SPY Holdings.
- **BatchCalculateRSIs** — Given a list of Symbols, return an RSI Result for each in order, applying the Rate-Limited Window between fetches.
- **GeneratePortfolioPlan** — Given a Trader Portfolio (an array of rows) and the S&P 500 top-20 set, augment each row with a Plan Signal and a reason string.

## Archived (Removed)

The terms below were part of FolioFlow's ubiquitous language when the `dump-rh` subcommand shipped. They are preserved here so returning contributors can find the historical context. They are **not** part of the active glossary; the integration they describe no longer exists in the codebase. See `docs/adr/0008-remove-robinhood-integration.md` for the removal decision.

- **Robinhood** — A retail brokerage. The removed integration hit `api.robinhood.com`, an undocumented private API. The domain did not name its endpoints, libraries, or auth protocol.
- **Robinhood Portfolio** — The Trader's current set of open stock/ETF positions at one broker, surfaced as a stable, FolioFlow-shaped JSON record. Always referred to the *current* state, never history.
- **Position** — A single open lot in the Robinhood Portfolio. Carried: Symbol, quantity, average buy price, current market price, market value, and unrealised P/L (absolute and percent).
- **Portfolio Dump** — The act of fetching the Robinhood Portfolio once and serialising it to `robinhood_portfolio.json` in the current working directory. Always replaced the file (no append, no merge).
- **Robinhood Credentials** — The Trader's Robinhood username and password. Accepted by the system; never logged, never echoed, never written to disk in plaintext.
- **Access Token** — The short-lived bearer credential (typically hours) used in the `Authorization: Bearer …` header on every authenticated Robinhood request. Obtained from `/oauth2/migrate_token/` after a successful classic login, then refreshed via `/oauth2/token/` with `grant_type=refresh_token`. Never persisted on its own; lived only in process memory for the duration of one Portfolio Dump.
- **Device Token Pair** — The persisted, password-derived-key-encrypted JSON object written to `~/.folioflow/robinhood_device_token` after the first successful Robinhood login. Shape (canonical):
  ```json
  { "v": 1, "access_token": "...", "refresh_token": "...", "issued_at": "...", "expires_in": 86400 }
  ```
  Contained both the Access Token and a longer-lived Refresh Token. Belonged to a single Trader on a single machine. The on-disk file was useless without the Trader's password. Replaced atomically on every successful refresh; deleted on refresh-token revocation.
- **Refresh Token** — The longer-lived credential (typically ~30 days) used to mint a new Access Token without re-prompting the Trader. Lived only inside the Device Token Pair. Rotated on every successful refresh.
- **MFA Challenge** — An out-of-band code (SMS or authenticator) that Robinhood could require on the first Portfolio Dump from a new device. The Trader supplied the code; FolioFlow did not generate or intercept it.
- **Robinhood Rate Limit** — A 429 response from `api.robinhood.com` indicating the Trader's IP had exceeded Robinhood's per-window request threshold. Distinct from an auth error: the credentials were still valid, the request was not. Surfaced as a `RobinhoodRateLimitError`.
- **DumpRobinhoodPortfolio** — Authenticated against Robinhood (using Robinhood Credentials or a stored Device Token), fetched the current Positions, and serialised them to `robinhood_portfolio.json`. Removed in `prd-md/remove-robinhood-prd.md`.
