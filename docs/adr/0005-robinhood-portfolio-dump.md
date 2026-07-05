# ADR-0005: Robinhood portfolio dump via the unofficial private API

- Status: **Deprecated** (rejected by ADR-0008 — integration removed)
- Date: 2026-07-01
- Context: FolioFlow — `dump-rh` subcommand (REMOVED — see ADR-0008)

## Context

The Trader wants FolioFlow to fetch their current open positions from Robinhood and dump them to JSON, alongside the existing Yahoo Finance / S&P 500 features. Robinhood exposes no official public API for retail portfolio access. The candidate reference is [sanko/Robinhood](https://github.com/sanko/Robinhood) — a documented but unofficial description of Robinhood's *private* API, not a runnable library.

## Decision

Add a new subcommand `dump-rh` that authenticates against Robinhood's private API (`api.robinhood.com`) and writes the current open stock/ETF positions to `./robinhood_portfolio.json` in the working directory.

Key shape decisions:

- **Source**: Direct HTTP calls to `api.robinhood.com`, hand-rolled in Node based on the sanko/Robinhood documentation. No third-party broker library is used.
- **Scope**: Current open stock/ETF positions only. Options, crypto, watchlists, and account balances are out of scope.
- **Authentication**: Username + password are supplied by the Trader on first run (env var or one-time prompt). If Robinhood returns an MFA challenge, the CLI prompts for the code. On success, the resulting **device token** is persisted to a local token store (path: `~/.folioflow/robinhood_device_token` or similar) and reused on subsequent runs. Re-runs are non-interactive as long as the token remains valid.
- **Credentials**: Username and password are accepted by the CLI but never logged, echoed, written to disk, or passed to any process other than the Robinhood login endpoint. The persisted device token is the only artefact that survives a run.
- **Output shape**: A stable, FolioFlow-owned JSON shape — *not* a raw passthrough of the Robinhood response. Per Position: `symbol`, `quantity`, `average_buy_price`, `current_price`, `market_value`, `unrealised_pl`, `unrealised_pl_pct`. The output file is replaced on every run (no append, no merge).
- **No piping into other FolioFlow commands in this iteration.** The dump is a standalone artifact.
- **Error handling**: A failed login, expired device token, or MFA timeout is surfaced as a `FolioFlowError` subclass (e.g. `RobinhoodAuthError`) and rendered to stderr in the same chalk-red style as the existing CLI errors.

## Consequences

Positive:
- The Trader can pull their current positions without leaving the terminal or copy-pasting from the Robinhood web UI.
- The new code lives entirely behind an Infrastructure-layer adapter (`RobinhoodAdapter`), so the rest of the codebase never sees the private API. Swapping to a CSV import later is a one-file change.
- Device-token persistence means the login friction is paid once per device, not per run.

Negative / acknowledged risks:
- **Terms of Service.** Automated access to Robinhood's private API is almost certainly prohibited by their Customer Agreement. The Trader uses this at their own risk; FolioFlow accepts no liability for account restrictions.
- **Fragility.** Robinhood can rotate endpoints, change auth, or roll out new anti-automation measures at any time. When they do, this feature breaks until the adapter is updated. There is no support contract to lean on.
- **Credential handling.** We take credentials as input. Even with our "never log, never persist" rules, the credentials pass through process memory and argv. This is a real security posture change from the rest of FolioFlow, which has *no* credentials at all.
- **No retry, no backoff.** Robinhood's anti-abuse signal on this surface is much higher than Yahoo Finance's. A single 429 on the login endpoint kills the run; we do not retry. The Trader re-runs.

## Superseded in part

The at-rest encryption of the device token, the refresh-token flow, and the new typed error classes (`RobinhoodRateLimitError`, `RobinhoodSchemaError`, `RobinhoodTokenStoreError`) are documented in [`docs/adr/0006-encrypted-device-token-pair.md`](./0006-encrypted-device-token-pair.md). This ADR is the canonical high-level rationale for the feature; ADR-0006 is the canonical rationale for the encryption and refresh follow-up.

## Alternatives considered

- **CSV / manual export import.** Rejected by the Trader. It removes the credential risk and the fragility, but at the cost of the very automation this feature exists to provide.
- **`robin-stocks` / `robinhood-crypto` (Python) community libraries.** Rejected: the project is Node-native, pulling in a Python sidecar is heavy; and the underlying risk profile (private API, ToS, fragility) is identical.
- **Defer the feature.** Rejected by the Trader. Documented here as the no-risk alternative.
- **Raw passthrough of the Robinhood response as the output schema.** Rejected: the Robinhood JSON shape is unstable and consumer-hostile. Owning the output schema is the same decision we made for the `rsi` subcommand (ADR-0002).
