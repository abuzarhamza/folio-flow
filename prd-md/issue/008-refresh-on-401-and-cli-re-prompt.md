---
title: "dump-rh: refresh-on-401, encrypted-store wiring, CLI re-prompt"
status: done
blocked_by:
  - 006-rate-limit-and-schema-errors
  - 007-encrypted-token-store
parent: prd-md/dump-rh-refresh-and-encrypted-token-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/dump-rh-refresh-and-encrypted-token-prd.md`

## What to build

A vertical slice that connects the encrypted store (007) to the adapter's auth flow (006) and updates the CLI to prompt for the password on every run. After this slice:

- `RobinhoodAdapter` accepts a `tokenStore` injection option (defaulting to a real `RobinhoodTokenStore` instance) and uses it to persist both `access_token` and `refresh_token` after a successful login.
- `RobinhoodAdapter.fetchPositions` performs a *silent* refresh on 401: it reads the existing envelope (using the in-memory plaintext held from the original login), calls `/oauth2/token/` with `grant_type=refresh_token`, and retries `fetchPositions` once. Only a *second* 401 bubbles up as `RobinhoodAuthError('Refresh token revoked')`.
- `DumpRobinhoodPortfolio` is updated to thread the password through to the token store on every read, and to the new `login` signature. The signature change is: `execute({ username, password, mfaCode? })` now requires the password on every call (the application service no longer assumes the password is only needed on first run).
- The CLI's `runDumpRH` prompts for the password on every run (not just first run) and uses the existing `fetchPositionsWithRetry` shape, extended with a `'Refresh token revoked.'` branch that deletes the cached envelope and re-prompts for *both* username and password.
- The `--client-id` CLI flag and `ROBINHOOD_CLIENT_ID` env var override are wired in this slice as the smallest cross-cutting change required to make the refresh call work without hard-coding a `client_id` into the new flow.

This is the slice that makes the *Trader* happy end-to-end: first run prompts for both, subsequent runs prompt for the password only, refresh is silent, revocation re-prompts.

## Acceptance criteria

- [ ] `RobinhoodAdapter` constructor accepts `{ httpClient, tokenStore, clientId, tokenPath }`. The default `tokenStore` is a `RobinhoodTokenStore` instance; the default `httpClient` is native `fetch`; the default `clientId` is the baked-in `DEFAULT_ROBINHOOD_CLIENT_ID`.
- [ ] `login` returns `{ access_token, refresh_token, issued_at, expires_in }` (the in-memory plaintext shape from `CONTEXT.md`).
- [ ] After `login`, the adapter writes the plaintext to the token store using the same `password` the Trader supplied.
- [ ] `fetchPositions` does a silent refresh-on-401 and retries once. The Trader does not see a prompt during a successful refresh.
- [ ] If the refresh call itself returns 401, the adapter deletes the cached envelope, then throws `RobinhoodAuthError('Refresh token revoked')`.
- [ ] `DumpRobinhoodPortfolio.execute` requires `password` on every call (no longer optional when a cached token exists).
- [ ] `cli.runDumpRH` always prompts for the password with the label "Robinhood password (needed to unlock your saved session): ".
- [ ] `cli.runDumpRH`'s `fetchPositionsWithRetry` extends with a `'Refresh token revoked.'` branch that deletes the envelope and re-prompts for username + password.
- [ ] The CLI reads `ROBINHOOD_CLIENT_ID` env var, then `--client-id` argv, then the baked-in default, in that order of precedence.
- [ ] `RobinhoodAdapter.test.js` extends with: refresh success, refresh 401 (throws `'Refresh token revoked'` and deletes the file), silent refresh-on-401 in `fetchPositions`.
- [ ] `DumpRobinhoodPortfolio.test.js` extends with: cached-token reuse requires password, refresh-on-401 is transparent to the caller, refresh rejection triggers a typed error.
- [ ] `index.test.js` extends with: subsequent-run CLI integration that types only a password (no username) and succeeds.
- [ ] All previously-passing tests still pass.

## Blocked by

- `006-rate-limit-and-schema-errors`
- `007-encrypted-token-store`
