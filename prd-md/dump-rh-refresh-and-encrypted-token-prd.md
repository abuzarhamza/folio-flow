## Problem Statement

`folioflow dump-rh` (slices 001–005) authenticates against Robinhood, fetches positions, and writes the canonical JSON. The first-run flow is wired end-to-end, but the Trader's experience on a *stable device* is the exact thing ADR-0005 was supposed to make pleasant: a device token is persisted to `~/.folioflow/robinhood_device_token` and the Trader expects to be able to re-run the command without re-typing credentials.

Today, the moment Robinhood's short-lived access token expires (hours), the Trader is forced back into the full username + password + MFA re-auth dance, and then the *next* run an hour later does it again. The current "device token" is a single plaintext access token, which also means the cached credential is exposed to any process or backup that can read `~/.folioflow/robinhood_device_token`.

## Solution

Upgrade `dump-rh` to a *refresh-token* flow with an *encrypted-at-rest* device token pair, so:

- A Trader who has logged in once on a device can re-run `folioflow dump-rh` transparently for the lifetime of the refresh token (typically ~30 days), with no prompts unless Robinhood actually challenges them.
- The on-disk token file is useless without the Trader's Robinhood password — encrypted with a key derived from it via `scrypt`. A `~` backup, an iCloud sync, or a `chmod` accident no longer leaks the brokerage credential.
- The Trader pays the password prompt on the *first* run (and on any refresh-token revocation) — and only then. Access-token expiry is handled silently in-process.

Concretely, the slice implements:

- A `RobinhoodTokenStore` infrastructure module that owns the on-disk JSON envelope `{ v, ct, salt, params }` and the in-memory plaintext shape `{ access_token, refresh_token, issued_at, expires_in }`. The envelope is encrypted with AES-256-GCM. The plaintext exists only in memory.
- A refresh-on-401 flow inside `RobinhoodAdapter` so an expired access token is *never* surfaced to the Trader as a "re-auth required" error unless the *refresh token* itself is rejected.
- A `RobinhoodRateLimitError` (`FolioFlowError` subclass) so a 429 from Robinhood is rendered distinctly from a credential error in the CLI's stderr.
- A whole-shape validator in `RobinhoodAdapter.fetchPositions` so upstream schema drift (e.g. the response moving from a bare array to `{ results: [...] }`) fails loudly, not silently.
- A `--client-id` CLI flag and `ROBINHOOD_CLIENT_ID` env var override on the default sanko/Robinhood-documented web client_id.

The four new slices are designed as tracer bullets: each one cuts through presentation → application → infrastructure and is demoable on its own (without breaking the other slices). The seam count is **two** — the existing `FolioFlow.dumpRobinhoodPortfolio` library entrypoint (highest seam) and the injected `httpClient` on `RobinhoodAdapter` (the only seam that needs to test the new HTTP code paths).

## User Stories

1. As a Trader, I want `folioflow dump-rh` to succeed on the second, third, and thirtieth run on the same device without re-entering my Robinhood password, so that the tool stays out of my way once it's set up.
2. As a Trader, I want a short CLI prompt for "Password (needed to unlock your saved session)" on a subsequent run, so that I understand why a password is needed when I have a cached session.
3. As a Trader, I want the CLI to type the password and not echo it to the terminal, so that shoulder-surfers and screen-shares don't capture it.
4. As a Trader, I want the cached session file (`~/.folioflow/robinhood_device_token`) to be useless to anyone who doesn't know my Robinhood password, so that an iCloud / Dropbox / Time Machine backup of my `~` doesn't leak my brokerage credential.
5. As a Trader, I want my access token to be refreshed silently when it expires (a few hours after login), so that I never see a 401 in the middle of my normal workflow.
6. As a Trader, I want to be re-prompted to log in if Robinhood revokes my refresh token (e.g. because I changed my Robinhood password), so that I have a clear, single recovery path instead of a stuck CLI.
7. As a Trader, I want a clear CLI error ("Robinhood rate limit hit; please retry in a few minutes") when my IP gets a 429, so that I know to wait rather than assume my password is wrong.
8. As a Trader, I want the dump to fail loudly with a "Robinhood response shape changed" error if Robinhood rotates the positions endpoint structure, so that an empty `robinhood_portfolio.json` is never silently produced.
9. As a Trader, I want `--client-id <string>` and `ROBINHOOD_CLIENT_ID` env var overrides for the OAuth client_id, so that I can un-break the tool myself when the baked-in default stops working, without waiting for a FolioFlow release.
10. As a Trader, I want the cached session file to be updated atomically, so that a power loss or process kill never leaves a half-written envelope that would lock me out.
11. As a Trader, I want the cached session file to be deleted automatically if the refresh token is rejected, so that the next run does not retry the same broken refresh and then fail again.
12. As a Trader, I want the cached session file to be mode `0600` and the directory `~/.folioflow/` to be mode `0700` on POSIX, so that the file is unreadable to other users on the same box.
13. As a Node developer importing FolioFlow, I want `ff.dumpRobinhoodPortfolio(credentials)` to throw the same `FolioFlowError` subclasses the CLI surfaces, so that I can `try/catch` on `RobinhoodAuthError` vs `RobinhoodRateLimitError` from a server context.
14. As a Node developer, I want the `RobinhoodAdapter` to accept an `httpClient` injection point, so that I can test the full login → MFA → refresh → fetchPositions flow with a fake HTTP client and no network.
15. As a maintainer, I want the refresh flow to live entirely inside `RobinhoodAdapter` (infrastructure), so that the application service (`DumpRobinhoodPortfolio`) does not have to know about HTTP or token types.
16. As a maintainer, I want the on-disk envelope to carry a `v: 1` schema version, so that future changes to the KDF params or envelope shape are detectable and migratable.
17. As a maintainer, I want a new `RobinhoodRateLimitError` class in the error hierarchy, distinct from `RobinhoodAuthError`, so that the CLI and library callers can tell "wait and retry" apart from "credentials are wrong."
18. As a maintainer, I want the whole-shape validator (`fetchPositions` returning a top-level array or `{ results: [...] }`) to be enforced at the adapter boundary, not in the application service, so that the application never sees a malformed upstream payload.
19. As a maintainer, I want the design decisions behind the encryption, refresh flow, and rate-limit error to be recorded as ADRs (`ADR-0006`), so that future contributors understand why the CLI is doing AES at rest.
20. As a CI maintainer, I want the new refresh + encryption logic to be covered by Jest unit tests using the injected `httpClient` fake, so that CI catches regressions without ever touching the live Robinhood API.

## Implementation Decisions

- **Refresh flow inside the adapter.** `RobinhoodAdapter.login`, `RobinhoodAdapter.refresh`, and `RobinhoodAdapter.fetchPositions` are three new infrastructure methods. Refresh-on-401 is a property of the adapter, not the application service. The application service remains: "take credentials, give back positions." The adapter's internal API is: "give me a token (yours or one I derive from a refresh), I'll use it."
- **`RobinhoodTokenStore` as a new infrastructure module.** The on-disk envelope (`{ v, ct, salt, params }`) and the in-memory plaintext (`{ access_token, refresh_token, issued_at, expires_in }`) live in `RobinhoodTokenStore.js`. The store exposes `read(password)`, `write(plaintext, password)`, `delete()`, and `exists()`. Reads decrypt with the password-derived key; writes re-encrypt with the *same* salt (no key rotation on refresh — the password hasn't changed).
- **Encryption choices (frozen by ADR-0006).** AES-256-GCM for the ciphertext; 16-byte random salt per envelope; key derived from the Trader's password via `crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })`. The IV is random per write, stored alongside the ciphertext inside the `ct` field as `<iv>:<tag>:<ciphertext>`. All `v: 1` envelopes use the same `params` set; future versions may bump params.
- **Atomic file writes.** Every write goes to `~/.folioflow/robinhood_device_token.tmp` (same directory) and is committed via `fs.renameSync`. The Trader's envelope is never half-written on a crash.
- **`RobinhoodRateLimitError` as a new `FolioFlowError` subclass.** Added to the existing error hierarchy in `src/errors.js`. The CLI's catch in `cli.runDumpRH` extends with a "please retry in a few minutes" rendering in chalk-yellow (warning, not error), since rate limits are transient. The library still throws the typed error so server consumers can decide their own backoff.
- **Whole-shape validator in `RobinhoodAdapter.fetchPositions`.** After the HTTP call, the adapter asserts the top-level response is either an array or an object with a `results` array (a known past shape). If neither, the adapter throws a `RobinhoodSchemaError` (also a new `FolioFlowError` subclass). The application service receives a clean array or no array at all — never a malformed one.
- **Configurable `client_id`.** `RobinhoodAdapter` constructor accepts `{ clientId, httpClient }`. The CLI reads `process.env.ROBINHOOD_CLIENT_ID`, then the `--client-id` argv flag, then a baked-in `DEFAULT_ROBINHOOD_CLIENT_ID` (the current sanko/Robinhood-documented web SPA value). Precedence: env > flag > default. All three are passed to the adapter.
- **Refresh-on-401 is silent and inline.** The adapter does not throw on 401 from `fetchPositions` if it has a refresh token available; it transparently calls `refresh`, retries `fetchPositions` once, and returns. Only a *second* failure (refresh itself returned 401) bubbles up as `RobinhoodAuthError('Refresh token revoked')`.
- **CLI re-prompt on refresh revocation.** `cli.runDumpRH`'s existing `fetchPositionsWithRetry` extends with a second branch for `'Refresh token revoked.'` that re-prompts the Trader for *both* username and password (we need the password to encrypt the new token envelope). The new credentials flow through the existing login path; the existing `RobinhoodTokenStore.delete()` runs first so the next refresh attempt doesn't loop.
- **`RobinhoodTokenStore` deletes the file on any decryption failure.** Same path as refresh-token revocation: delete, re-prompt. We do *not* distinguish "wrong password" from "tampered file" at the CLI surface — both are "start fresh."
- **No new domain layer.** This PRD is an evolution of the existing infrastructure/application layers. The glossary updates in `CONTEXT.md` (the two-term split: Access Token vs Device Token Pair; new terms Refresh Token, Robinhood Rate Limit) are the only domain-layer changes.
- **No retry / backoff on 429.** The CLI surfaces the error and exits 1; the Trader re-runs. Robinhood's anti-abuse signal is high enough that smart retry inside the tool would cause more harm than good (and would be impossible to tune without their anti-abuse team's playbook). Documented as a follow-up.
- **No native deps.** AES / scrypt / GCM are all in Node's standard `crypto` module. No `keytar`, no `node-keytar`, no platform-specific code. The slice ships with zero new dependencies.

## Testing Decisions

- **What makes a good test for this PRD**: assert the *observable* behaviour — encrypted-on-disk shape, in-memory plaintext shape, error types thrown, CLI prompts shown, atomic write (no half-file), and the end-to-end login → MFA → refresh → fetchPositions sequence via a fake `httpClient`. Do not assert on internal method names beyond the public surface; do not assert on `process.stdin` byte-by-byte.
- **Two seams, two test files**:
  - **Seam 1 (highest, existing):** `DumpRobinhoodPortfolio.test.js` extends with cases for: cached-token reuse, refresh-on-401, refresh-rejection-triggers-re-auth, missing-credentials-throws, rate-limit-throws-typed-error, schema-drift-throws-typed-error. The adapter is mocked at the constructor.
  - **Seam 2 (new, the HTTP boundary):** `RobinhoodAdapter.test.js` is a new file that constructs the adapter with a fake `httpClient` (a function that returns a canned `{ status, body }` per call) and asserts: login success, login MFA challenge (re-posts with mfa_code), login 401, login 429, refresh success, refresh 401, fetchPositions with raw array response, fetchPositions with `{ results: [...] }` response, fetchPositions with malformed response (throws `RobinhoodSchemaError`).
- **Prior art:**
  - `SPYHoldingsAdapter.test.js` — direct constructor instantiation, no mocks. The pattern for `RobinhoodAdapter.test.js`.
  - `BatchCalculateRSIs.test.js` — mocked application-service collaborators. The pattern for `DumpRobinhoodPortfolio.test.js` extensions.
  - `index.test.js` — CLI integration via `child_process.execFileSync`. The existing pattern; we extend it with one new case that proves the re-prompt branch works end-to-end.
- **No `nock`, no `msw`.** The `httpClient` injection seam is the right level for this codebase. The project has no precedent for HTTP interception libraries; adding one is YAGNI for two POSTs and one GET.
- **Existing tests stay green.** All five existing dump-rh slices' tests + every other layer test must pass without modification. The only test changes allowed are additions.
- **No new test framework, no new assertion library.** Jest only. The fake `httpClient` is a plain function.

## Out of Scope

- Argon2id migration (scrypt is sufficient for the CLI's threat model; the `v: 1` envelope makes this a future-PR swap).
- Smart retry / exponential backoff on 429 (documented in `Further Notes`).
- Encryption of in-memory state at runtime (Node's heap is assumed out of threat scope; the Trader's password is GC'd after the run).
- A web UI for inspecting the on-disk envelope.
- Multi-account support (one Trader, one machine, one envelope).
- Replacing the CLI prompt with `--password-from-stdin` or a keychain integration.
- Anything in `prd.md` not directly related to the refresh / encryption / error-shape change. The RSI, sync-spy, batch-spy, and library-API surfaces are untouched.

## Further Notes

- **Why `scrypt` over Argon2id.** Argon2id is the modern recommendation, but `scrypt` is in `node:crypto` standard library with no native dep, has a stable param set, and is the conservative choice for a CLI that runs once a day. If Node ships `crypto.argon2id` in a future LTS, the `v: 1` envelope design supports a clean migration.
- **Why the Trader still re-types the password on the first re-run.** Because we need the password to derive the decryption key. The mitigation is the prompt message: "Password (needed to unlock your saved session)" so the Trader understands why.
- **Why the refresh-on-401 lives in the adapter, not the application service.** The application service is HTTP-agnostic; it does not know what a 401 means. The adapter is the only layer that should care about HTTP semantics. Putting the refresh loop there also means the application service's "give me positions" contract is unchanged from the original slice.
- **Why no smart retry on 429.** Robinhood's anti-abuse logic is opaque. A retry that *we* think is "polite" might be exactly the pattern their system is trying to detect. Better to surface the error and let the Trader decide; they can re-run with `--client-id` or wait. Documented as a future-PR in `prd-md/` once we have telemetry.
- **Glossary updates in `CONTEXT.md`:** the `Device Token` entry is split into `Access Token` + `Device Token Pair` + `Refresh Token`; a new `Robinhood Rate Limit` term is added; the existing `MFA Challenge` term is unchanged. The PRD respects the existing `Robinhood Portfolio`, `Position`, `Portfolio Dump`, and `Robinhood Credentials` terms.
- **ADR-0006 (`encrypted-device-token-pair.md`)** captures the at-rest-encryption decision in full; the PRD points to it as the authoritative explanation.
