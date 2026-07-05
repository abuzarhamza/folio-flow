---
title: "dump-rh: encrypted device token pair (RobinhoodTokenStore)"
status: done
blocked_by:
  - 006-rate-limit-and-schema-errors
parent: prd-md/dump-rh-refresh-and-encrypted-token-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/dump-rh-refresh-and-encrypted-token-prd.md`

## What to build

A vertical slice that introduces the on-disk encrypted token envelope, independent of any HTTP or CLI change. After this slice:

- A new `RobinhoodTokenStore` infrastructure module exists with `read(password)`, `write(plaintext, password)`, `delete()`, and `exists()` methods.
- The envelope written to `~/.folioflow/robinhood_device_token` is `{ v: 1, ct: "<base64>", salt: "<base64>", params: { N, r, p } }` — AES-256-GCM ciphertext, random 16-byte salt, scrypt-derived 32-byte key. The on-disk file is mode `0o600`; the directory is mode `0o700` on POSIX.
- A `read` with the wrong password throws a distinct typed error (`RobinhoodTokenStoreError extends FolioFlowError`).
- All writes are atomic: `fs.writeFileSync` to a `*.tmp` sibling, then `fs.renameSync` over the target.
- The `DumpRobinhoodPortfolio` application service is *not* yet updated to use the store; it still uses the existing plaintext single-token reader/writer. The store is wired in slice 008.

This slice ships the store in isolation, fully unit-tested, so that slice 008 can swap it in without re-doing the crypto work.

## Acceptance criteria

- [ ] New file `src/infrastructure/RobinhoodTokenStore.js` defines a class with `read`, `write`, `delete`, `exists` methods plus a `TOKEN_PATH` constant.
- [ ] `write(plaintext, password)` creates the directory at `~/.folioflow/` with mode `0o700` (best-effort chmod, Windows-safe) and writes the envelope atomically.
- [ ] `read(password)` decrypts the envelope and returns the plaintext object, or throws `RobinhoodTokenStoreError` if the password is wrong or the file is missing/tampered.
- [ ] `delete()` removes the file if it exists; idempotent.
- [ ] `exists()` returns a boolean.
- [ ] On-disk file mode is `0o600` on POSIX; the on-disk file contents are *not* the plaintext access or refresh tokens under any test scenario.
- [ ] New `RobinhoodTokenStore.test.js` covers: round-trip write/read, wrong password throws, tampered file throws, missing file throws, delete is idempotent, atomic write (the `.tmp` file does not survive a successful write).
- [ ] `RobinhoodTokenStoreError` is added to `src/errors.js` and re-exported.
- [ ] All previously-passing tests still pass; the application service is unchanged in this slice.

## Blocked by

- `006-rate-limit-and-schema-errors`
