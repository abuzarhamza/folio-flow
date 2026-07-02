# PRD: Robinhood portfolio dump (`folioflow dump-rh`)

> Synthesised from the `/grill-with-docs` session on 2026-07-01. See `CONTEXT.md` for the ubiquitous language and `docs/adr/0005-robinhood-portfolio-dump.md` for the architectural decision. Triage label requested: `ready-for-agent`.

## Problem Statement

A momentum trader who uses FolioFlow to scan the S&P 500 with Yahoo Finance RSI(22/44/66) also has a personal Robinhood brokerage account. To use FolioFlow's signal on *their own money*, they currently have to: log into robinhood.com in a browser, open the positions page, copy the symbol list, paste it into a separate file, then run FolioFlow on it. This is friction, and the manual step is exactly the kind of error-prone copy-paste the rest of FolioFlow exists to remove.

## Solution

Add a new FolioFlow subcommand, `folioflow dump-rh`, that authenticates against Robinhood on behalf of the Trader, fetches their current open stock/ETF positions, and writes them to `./robinhood_portfolio.json` in the working directory — using the same JSON-on-stdout, file-on-disk pattern as the existing `sync-spy` and `batch-spy` commands.

The new subcommand is also exposed on the library side: `FolioFlow.dumpRobinhoodPortfolio({ username, password })` returns the parsed Position array, with no file IO. This matches the symmetry of `getRSI` / `syncSPYHoldings` / `runBatchRSIs` in the existing API surface.

The integration is a thin **Infrastructure adapter** that calls `api.robinhood.com` directly, hand-rolled in Node against the [sanko/Robinhood](https://github.com/sanko/Robinhood) documentation. No new third-party broker library is added. Authentication happens once per device: the first run prompts for username, password, and (if Robinhood challenges) an MFA code; the resulting device token is persisted locally and reused on every subsequent run.

## User Stories

1. As a momentum trader, I want to type `folioflow dump-rh` from my terminal, so that I can pull my current Robinhood positions into a JSON file without opening a browser.
2. As a momentum trader, I want the dump to overwrite `robinhood_portfolio.json` on every run, so that the file always reflects the most recent fetch and I never wonder if it's stale.
3. As a momentum trader, I want to be prompted for my username and password the first time, and for FolioFlow to remember the device afterward, so that I don't have to re-type credentials on every run.
4. As a momentum trader with MFA enabled (which is everyone on Robinhood), I want FolioFlow to prompt me for the MFA code when Robinhood challenges it, so that first-time setup works without me touching browser cookies or device settings.
5. As a momentum trader, I want my password to never appear in logs, debug output, or on disk, so that a stray `tail -f` or `git status` doesn't leak it.
6. As a momentum trader, I want the device token to be stored in a well-known local file (not in the project directory), so that my credentials don't end up in version control by accident.
7. As a momentum trader, I want only my current open stock/ETF positions to appear in the dump — no closed lots, no options, no crypto, no watchlists, no account balances — so that the file is small and immediately useful for downstream analysis.
8. As a momentum trader, I want the JSON shape to be FolioFlow-owned and stable, not whatever Robinhood's API happens to return today, so that downstream scripts don't break when Robinhood changes a field name.
9. As a momentum trader, I want each Position to include at least `symbol`, `quantity`, `average_buy_price`, `current_price`, `market_value`, `unrealised_pl`, and `unrealised_pl_pct`, so that I can answer "what do I own and how is it doing right now?" in one read.
10. As a momentum trader, I want authentication failures (bad password, expired device token, MFA timeout) to surface as a single clear error on stderr in the same red style as existing FolioFlow errors, so that I know whether to re-run, re-auth, or contact Robinhood.
11. As an integrator scripting against FolioFlow as a Node module, I want `ff.dumpRobinhoodPortfolio({ username, password })` to return a parsed array of Positions and throw a typed error on failure, so that I can use it inside a larger pipeline without parsing CLI output.
12. As an integrator, I want to be able to inject a mock Robinhood adapter into the `FolioFlow` constructor, so that I can write tests against `dumpRobinhoodPortfolio` without hitting the real Robinhood API.
13. As a momentum trader, I want the dump-rh subcommand to follow the existing CLI conventions — JSON to stdout, a one-line status summary, file written to disk — so that it feels native to FolioFlow and not like a bolted-on script.
14. As a momentum trader, I want `folioflow --help` to list `dump-rh` alongside the existing subcommands, so that the new command is discoverable.
15. As a momentum trader, I want a stale or revoked device token to be detected and surfaced as a clear "re-auth required" error, so that I'm not stuck wondering why the run silently produced zero positions.

## Implementation Decisions

### Architecture

- The feature is built behind a new **Infrastructure-layer adapter** (`RobinhoodAdapter`) that exposes a narrow, domain-shaped surface: `login({ username, password, mfaCode? })` returning a token, and `fetchPositions(token)` returning the raw Robinhood positions.
- A new **Application-layer use case** (`DumpRobinhoodPortfolio`) orchestrates: resolve credentials → ensure a valid device token (loading from disk or logging in fresh) → call the adapter for positions → normalise the response into the FolioFlow Position shape.
- The `FolioFlow` composition root in `index.js` exposes `dumpRobinhoodPortfolio({ username, password })` as a thin call into the use case. The CLI handler in `src/cli.js` is the only place that writes `robinhood_portfolio.json` to disk; the library API never touches the filesystem.
- All architectural rules from ADR-0001 (Presentation → Application → Infrastructure, no cross-layer imports) apply unchanged.

### Authentication and credential handling

- Credentials are accepted as parameters (`{ username, password, mfaCode? }`) and passed straight to the adapter. They are never logged, never echoed via `debug(...)`, and never written to disk in plaintext.
- The persisted artefact is a **device token** only. It is stored at `~/.folioflow/robinhood_device_token` (resolved from `os.homedir()`), outside the project directory, with `0600` file permissions on POSIX.
- The CLI prompt is implemented in the Presentation layer. On first run, the CLI prompts for `username` and `password` (read from stdin without echoing); if the adapter response indicates an MFA challenge, the CLI prompts for the MFA code and retries. The CLI does not read credentials from argv to avoid them landing in shell history.
- The use case, when it has a cached device token, calls `adapter.fetchPositions(token)` directly. If the adapter rejects the token (HTTP 401, expired), the use case throws a `RobinhoodAuthError` instructing the user to re-authenticate. The cached token is *not* silently deleted on a 401 — the Trader decides.

### Output schema

The dump file is a JSON object with two top-level keys: `asOf` (ISO-8601 timestamp of the fetch) and `positions` (an array). The canonical Position shape (prototype-derived, this is the only place in the PRD that contains a snippet because shape decisions are easy to lose in prose):

```json
{
    "asOf": "2026-07-01T18:50:00.000Z",
    "positions": [
        {
            "symbol": "AAPL",
            "quantity": 12,
            "average_buy_price": 178.42,
            "current_price": 191.05,
            "market_value": 2292.60,
            "unrealised_pl": 151.56,
            "unrealised_pl_pct": 7.08
        }
    ]
}
```

- The schema is owned by FolioFlow, not by Robinhood. The adapter is responsible for mapping Robinhood's private-API field names into the canonical shape. If Robinhood adds a field, it does not appear in the dump unless we explicitly add it to the schema.
- The output file is fully replaced on every run (no append, no merge). The Trader can rely on the file reflecting the most recent fetch.
- `asOf` is captured at the moment the adapter returns, not at the moment the CLI command started, so the timestamp is honest about when the data was retrieved.
- Fields that Robinhood does not provide for a given position (e.g. an instrument with no `average_buy_price` for fractional shares) are emitted as `null`, not omitted, to keep the shape uniform.

### CLI surface

- The new subcommand is `folioflow dump-rh`. It takes no positional arguments. It accepts no flags in this iteration.
- On success, stdout is a one-line JSON status: `{"status":"success","positionsCount":<n>,"file":"robinhood_portfolio.json"}` — exactly mirroring the `sync-spy` and `batch-spy` status payloads.
- Errors are rendered on stderr in chalk red, prefixed with `Error:`, with a non-zero exit code. This matches the existing `bin/folioflow.js` `.fail()` handler.
- The `--help` epilogue is updated to list `dump-rh` alongside the existing subcommands.

### Errors

- A new error subclass `RobinhoodAuthError extends FolioFlowError` is added for authentication failures (bad credentials, MFA timeout, expired device token).
- The existing `AdapterError` and `InvalidSymbolError` semantics are reused where they fit (network failures, malformed responses).
- The Presentation layer catches `FolioFlowError` subclasses and renders them the same way it already does.

### Dependencies

- No new third-party dependencies. HTTP is done with the native `fetch` API (Node 18+), already used by `SPYHoldingsAdapter`. JSON parsing is built-in. File permissions use `fs.fchmod` / `fs.chmod` (built-in).
- The `sanko/Robinhood` repository is referenced for endpoint documentation, not as a runtime dependency.

### Out of architecture

- No background workers, no scheduled runs, no daemon mode. The Trader runs the command when they want a fresh dump.
- No caching layer. Every run hits the Robinhood API. (A future ADR could revisit this if the Trader's portfolio grows large enough to hit anti-abuse signals.)
- No pipelining into `folioflow rsi` in this iteration. The dump is a standalone artifact. (Future feature.)

## Testing Decisions

### What makes a good test

A good test exercises the system through its highest practical seam and asserts on external behaviour, not internal implementation. The bar for "this test is correct" is: a Trader or an Integrator could read the test and recognise the user-facing behaviour it's protecting.

### Seams we will test (matching existing project conventions)

- **CLI integration seam** — extend `index.test.js` with cases that spawn `node index.js dump-rh` and assert on:
  - exit code,
  - the JSON status line on stdout,
  - the contents of `robinhood_portfolio.json` written to disk,
  - the red `Error:` line on stderr for failure cases.
  The existing `jest.mock` of `src/infrastructure/SPYHoldingsAdapter` is mirrored: a `jest.mock` of `src/infrastructure/RobinhoodAdapter` returns canned positions so the test stays offline.

- **Application service seam** — if the use case ends up with non-trivial orchestration (token resolution, error mapping, normalisation), add a unit test in the same style as `GetStockRSIs.test.js` — construct the service with a mock adapter, assert on the returned array and on the thrown error subclasses. This is optional and only fires if the use case is non-trivial.

### Seams we will NOT test

- The Infrastructure adapter will not be tested against the live Robinhood API. The adapter is treated as a leaf; its behaviour is covered indirectly via the mocked CLI integration test.
- The CLI prompt interaction (`readline`, stdin handling) will not be tested at the unit level; it is treated as part of the Presentation layer and covered by the integration seam.

### Prior art

- `index.test.js` — CLI-level integration tests that mock adapters, spawn the binary, and assert on stdout/stderr/exit code. The Robinhood tests follow this exact pattern.
- `GetStockRSIs.test.js` — Application service unit test with a mock adapter. Mirrored only if the use case merits it.
- `SPYHoldingsAdapter.test.js` — demonstrates that Infrastructure adapters can be unit-tested directly when needed. We are deliberately not doing this for `RobinhoodAdapter` because the live API is fragile and we have nothing to gain by hitting it in tests.

### What we are explicitly NOT testing

- That the dump is byte-identical to a fixture snapshot (Robinhhood's response will drift; the schema is what we own).
- That MFA flow works end-to-end (it requires real Robinhood credentials, which we will never have in CI).
- That the device-token file has `0600` permissions on every supported platform (POSIX-only concern; documented in the Further Notes instead).

## Out of Scope

- Options, crypto, watchlists, account balances, banking/ACH, and order history. The dump covers **current open stock/ETF positions only**.
- Live piping of the dumped Symbols into a future `folioflow rsi --from-portfolio` flow. The dump is a standalone artifact.
- Raw passthrough of the Robinhood response. The schema is FolioFlow-owned.
- A background daemon, scheduled runs, or file-watcher mode.
- Multi-broker support (Schwab, Fidelity, IBKR, etc.). The new adapter is Robinhood-specific by name and by endpoint.
- Caching. Every run is a live fetch.
- 2FA via SMS/email polling. MFA is captured at the prompt only.
- Internationalisation of error messages.

## Further Notes

### Risk acknowledgement

This feature relies on Robinhood's private, undocumented API. Robinhood can (and routinely does) change endpoints, authentication flows, and field names without notice. The acceptance criteria for the feature explicitly do **not** include "this works in six months without maintenance" — that is the inherent trade-off captured in ADR-0005. The maintainer of FolioFlow is expected to update the adapter when Robinhood breaks it.

Use of this feature is almost certainly a violation of Robinhood's Customer Agreement / API Terms. The Trader uses it at their own risk; FolioFlow accepts no liability for account restrictions, balance disputes, or any other consequence of automated access to the broker.

### Why not `robin-stocks` or another community library?

A Node-native, no-new-dependency implementation is preferred because:

- The project is committed to a strict DDD layer split (ADR-0001) and to keeping the library as small as possible.
- The underlying risk profile (private API, ToS, fragility) is identical whether we hand-roll the HTTP or wrap a community library; the community library is not "more legitimate" than direct calls, only less work.
- A community library would still need to be wrapped in our own adapter to keep the Application layer provider-agnostic.

### Device-token storage details

- Path: `~/.folioflow/robinhood_device_token`
- Permissions: `0o600` (POSIX). The use case `chmod`s the file after writing.
- On Windows, the chmod call is a best-effort no-op; the directory permissions model is different and we accept that.
- The token file is not gitignored automatically — the Trader must add `~/.folioflow/` to their global gitignore. (Documented in the README when the feature ships.)

### Schema stability

The Position shape is a **public contract** of FolioFlow the moment this feature ships. Any change to field names, types, or nullability is a breaking change and requires a major-version bump. The integrator-facing library API (`ff.dumpRobinhoodPortfolio`) returns the same array the CLI writes to disk — one source of truth.

### Status: tracker

This PRD is being saved to `prd-md/robinhood-portfolio-dump.md` because no project issue tracker is configured in this repository. If a tracker is added later, the issues produced by the `to-issues` skill should be created against this PRD as the parent.
