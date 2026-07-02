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
- **RSI Result** — The composite output for a single Symbol. Contains the Symbol plus the current RSI for each configured Period. Shape (canonical, exactly as emitted on stdout):
  ```json
  { "symbol": "AAPL", "rsi_22": 53.82, "rsi_44": 55.67, "rsi_66": 55.95 }
  ```
- **RSI Average** — The arithmetic mean of the three configured RSI values for a Symbol. Reported by the library API; the CLI does not emit it.
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
- **Robinhood** — A retail brokerage. Adapter-wrapped; the domain does not name it. FolioFlow does not name its endpoints, libraries, or auth protocol.

## Robinhood portfolio dump

- **Robinhood Portfolio** — The Trader's current set of open stock/ETF positions at one broker, surfaced as a stable, FolioFlow-shaped JSON record. Always refers to the *current* state, never history.
- **Position** — A single open lot in the Robinhood Portfolio. Carries: Symbol, quantity, average buy price, current market price, market value, and unrealised P/L (absolute and percent).
- **Portfolio Dump** — The act of fetching the Robinhood Portfolio once and serialising it to `robinhood_portfolio.json` in the current working directory. Always replaces the file (no append, no merge).
- **Robinhood Credentials** — The Trader's Robinhood username and password. Accepted by the system; never logged, never echoed, never written to disk in plaintext.
- **Device Token** — A persisted authentication artefact obtained after the first successful Robinhood login, including any MFA challenge. Stored on disk so subsequent Portfolio Dumps do not require a fresh login. Belongs to a single Trader on a single machine.
- **MFA Challenge** — An out-of-band code (SMS or authenticator) that Robinhood may require on the first Portfolio Dump from a new device. The Trader supplies the code; FolioFlow does not generate or intercept it.

## Application services (use cases) — updated

- **GetStockRSIs** — Given one Symbol, return that Symbol's RSI Result. Always fetches its own Historical Prices.
- **SyncSPYHoldings** — Refresh `snp500.json` from the current SPY Holdings.
- **BatchCalculateRSIs** — Given a list of Symbols, return an RSI Result for each in order, applying the Rate-Limited Window between fetches.
- **DumpRobinhoodPortfolio** — Authenticate against Robinhood (using Robinhood Credentials or a stored Device Token), fetch the current Positions, and serialise them to `robinhood_portfolio.json`.
