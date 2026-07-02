---
title: "dump-rh: login and device-token persistence"
status: done
blocked_by:
  - 001-dump-rh-skeleton-and-error-class
parent: prd-md/robinhood-portfolio-dump.md
---

## Parent

PRD: `prd-md/robinhood-portfolio-dump.md`

## What to build

A vertical slice that wires the real Robinhood login flow. After this slice:

- The Infrastructure adapter exposes a `login({ username, password, mfaCode? })` method that hits `api.robinhood.com` per the [sanko/Robinhood](https://github.com/sanko/Robinhood) documentation.
- The Presentation layer (CLI) prompts for username, password, and (if the adapter indicates an MFA challenge) the MFA code, all read from stdin without echoing.
- On successful login, the resulting device token is persisted to `~/.folioflow/robinhood_device_token` with POSIX `0600` permissions. Subsequent runs detect the cached token and skip the login prompt.
- A stale or rejected token surfaces as `RobinhoodAuthError` with a clear "re-auth required" message. The cached token is *not* silently deleted — the Trader decides.
- The slice is fully testable offline: the test mocks the adapter and asserts on the prompts, the token file path and permissions, and the re-auth-required error.

The dump file is not written in this slice — it is wired in slice 4. This slice proves auth works end-to-end against the adapter, with positions-fetch stubbed.

## Acceptance criteria

- [ ] `RobinhoodAdapter.login` performs an HTTP `POST` to the documented Robinhood login endpoint with the supplied credentials and returns a token.
- [ ] An MFA challenge from the adapter triggers a second prompt for the MFA code; the adapter is then called again with the code.
- [ ] The CLI prompts for username and password without echoing them (readline with `silent: true` or equivalent).
- [ ] A successful login writes the device token to `~/.folioflow/robinhood_device_token` with `0600` permissions on POSIX.
- [ ] If a token file already exists and the adapter accepts it, the CLI does not re-prompt for credentials.
- [ ] If the adapter rejects a cached token (HTTP 401), the CLI throws `RobinhoodAuthError` with a message telling the Trader to re-authenticate. The cached token is left on disk.
- [ ] `index.test.js` covers: successful first-run login (mocked), MFA challenge path, cached-token reuse, expired-token re-auth error.
- [ ] No positions data is fetched in this slice; the use case is wired but the response is unused.

## Blocked by

- `001-dump-rh-skeleton-and-error-class`
