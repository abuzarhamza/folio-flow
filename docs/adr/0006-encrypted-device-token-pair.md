# ADR-0006: Encrypted-at-rest device token pair, password-derived key

- Status: **Deprecated** (rejected by ADR-0008 — integration removed)
- Date: 2026-07-02
- Context: FolioFlow — `dump-rh` subcommand, refresh-token persistence (ADR-0005 follow-up; REMOVED — see ADR-0008)

## Context

`dump-rh` persists a device token so the Trader does not have to re-enter credentials on every run. ADR-0005 specified that the token is stored on disk and reused, but did not specify its on-disk format, at-rest protection, or refresh-token handling. The Robinhood access token is a long-lived bearer credential; the refresh token is a longer-lived one. Either is functionally equivalent to a brokerage password for the lifetime of the token.

A Trader's `~` is regularly backed up (iCloud, Dropbox, OneDrive, Time Machine), synced to other machines, and occasionally shared via `tar`/`zip` for support. A plaintext device token at `~/.folioflow/robinhood_device_token` would leak the Trader's brokerage access in any of these scenarios.

## Decision

Persist the device token as a single JSON object at `~/.folioflow/robinhood_device_token`, encrypted at rest with a key derived from the Trader's Robinhood password via `scrypt`.

Shape on disk (canonical, exactly as written):

```json
{ "v": 1, "ct": "<base64 ciphertext>", "salt": "<base64 salt>", "params": { "N": 16384, "r": 8, "p": 1 } }
```

Plaintext shape (decrypted in memory, never written to disk):

```json
{ "access_token": "...", "refresh_token": "...", "issued_at": "2026-07-02T12:34:56Z", "expires_in": 86400 }
```

Lifecycle:

- **First run.** Trader types username + password. Adapter calls `/oauth2/token/` with `grant_type=password`. On success, generates a random 16-byte salt, derives a 32-byte key via `crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })`, encrypts the token pair with `crypto.createCipheriv('aes-256-gcm', key, iv)`, and atomically writes the JSON envelope to disk. Password is then discarded.
- **Subsequent runs.** Trader types password (we need it to derive the decryption key). Adapter reads the envelope, derives the key, decrypts. If the access token is still valid, uses it directly. If expired, calls `/oauth2/token/` with `grant_type=refresh_token`, re-encrypts with the *same* salt + key, atomically rewrites the file.
- **Refresh-token revocation.** The refresh call returns 401/403. Adapter deletes the envelope from disk (so the next run starts fresh), throws a `RobinhoodAuthError('Refresh token revoked')`. `cli.runDumpRH` catches it, re-prompts the Trader for username + password, runs a fresh login.
- **Decryption failure** (wrong password, file tampered, format drift). Treated identically to refresh-token revocation: delete the file, prompt for credentials.
- **Atomic write.** All writes go to a `*.tmp` sibling, then `fs.rename` over the target. The on-disk file is always a complete envelope, never a half-written one.
- **File mode.** `0o600`. The directory `~/.folioflow/` is created with `0o700` on first write. We do not enforce this on read (Windows / WSL compatibility, per the existing `writeCachedToken` precedent).

## Consequences

Positive:
- A backup or sync that includes `~/.folioflow/robinhood_device_token` is useless without the Trader's password. The single most likely leak vector is closed.
- The on-disk envelope is *versioned* via the `v` field. Future format changes (adding `mfa_type`, changing the KDF params, switching to Argon2id) are detectable and migratable.
- The Trader's password lifetime in process memory is bounded: it exists for the duration of one login or one decryption, then is garbage-collected. We do not hold it across HTTP round-trips.
- The refresh flow means the Trader re-logs in roughly once a month on a stable device, not once per access-token expiry (~daily). The cost of encryption is one extra password prompt on the first run.

Negative / acknowledged risks:
- **First-run password requirement.** Even when a token envelope is already on disk, the Trader must type the password to derive the decryption key. This is a real UX cost vs. plaintext storage. We mitigate it by being explicit in the prompt: "Password (needed to unlock your saved session)."
- **`scrypt` cost.** A 16 MiB N is a real CPU hit (~100ms on a modern laptop). It is the *right* trade-off for a CLI that runs once a day, but it would be wrong for a server. We accept it.
- **No password rotation without losing tokens.** If the Trader changes their Robinhood password, the old password can no longer decrypt the envelope, and the file is deleted on the next run. They pay one full re-auth. This is the correct behaviour — the old password is no longer a valid Robinhood credential anyway.
- **Disk-recovery attack.** An attacker with read access to the file can run a dictionary attack against the password. `scrypt` makes this expensive but not impossible. The standard mitigation is a strong Robinhood password; we cannot enforce it.

## Alternatives considered

- **Plaintext at `0o600`.** Rejected: backup / sync / chmod accidents are the dominant real-world leak vector. The protection that `0o600` offers is "don't let the *other user on the same box* read this," which is not the threat we're defending against.
- **OS keychain via `keytar` / `@napi-rs/keyring`.** Rejected: native dependency that breaks on headless / CI / Docker / WSL environments. We already take the Trader's password on the first run; deriving a key from it is a strict superset of "store the password in the keychain" with no native dep and no platform divergence.
- **Argon2id instead of `scrypt`.** Considered. Argon2id is the modern recommendation for password-based KDF. We chose `scrypt` because (a) it is in Node's standard library as `crypto.scrypt`, no extra dep, (b) it has been the conservative choice for over a decade, (c) the param set `{ N: 16384, r: 8, p: 1 }` is portable across Node versions. If Node ships a stable `crypto.argon2` in a future LTS, we will migrate; that is the kind of thing the `v: 1` envelope is designed to make safe.
- **Two files (one per token).** Rejected in Q4 of the design grill: partial writes leave the Trader locked out on crash, and the JSON envelope matches the wire format.
- **No refresh, force re-login on every access-token expiry.** Rejected in Q3 of the design grill: a Trader who has to re-enter their password + MFA every few days will quietly stop using the tool, and the persistence we fought to add in ADR-0005 becomes cosmetic.
