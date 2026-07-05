---
title: "dump-rh: ADR cross-references and documentation"
status: done
blocked_by:
  - 006-rate-limit-and-schema-errors
  - 007-encrypted-token-store
  - 008-refresh-on-401-and-cli-re-prompt
parent: prd-md/dump-rh-refresh-and-encrypted-token-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/dump-rh-refresh-and-encrypted-token-prd.md`

## What to build

A vertical slice that updates the human-facing surfaces to reflect the new design. After this slice:

- The `README.md` `dump-rh` section is updated to document: the password-on-every-run UX, the `--client-id` flag, the `ROBINHOOD_CLIENT_ID` env var, the on-disk envelope path and its `0o600` mode, and the rate-limit / schema-drift error messages a Trader may see.
- `CONTEXT.md` glossary is already updated (it was updated inline during the design grill). This slice confirms the live file matches the locked-in terms and the file has a single "Last updated" line referencing this PRD.
- `ADR-0005` is updated with a "Superseded in part by ADR-0006" note pointing at the new ADR. (The new ADR exists already; the cross-reference is the slice's deliverable.)
- The bin-and-module-api PRD's "Public API shape" section is *not* changed; this slice respects that the `dump-rh` work is a vertical evolution of an existing feature, not a library-surface redesign.

This slice is the last one and contains no production code changes — only documentation. It exists as a separate issue so a contributor who has just shipped slices 006–008 can land the docs in a self-contained PR without churning the code.

## Acceptance criteria

- [ ] `README.md` has a `dump-rh` section that documents: first-run UX, subsequent-run UX (password prompt), `--client-id`, `ROBINHOOD_CLIENT_ID`, token file path + mode, rate-limit recovery, schema-drift recovery.
- [ ] `CONTEXT.md` contains the `Access Token`, `Device Token Pair`, `Refresh Token`, and `Robinhood Rate Limit` glossary entries added during the design grill.
- [ ] `docs/adr/0005-robinhood-portfolio-dump.md` has a "Superseded in part" footer pointing to `docs/adr/0006-encrypted-device-token-pair.md` for at-rest encryption, refresh flow, and the new error classes.
- [ ] No production code is changed in this slice.
- [ ] All previously-passing tests still pass.

## Blocked by

- `006-rate-limit-and-schema-errors`
- `007-encrypted-token-store`
- `008-refresh-on-401-and-cli-re-prompt`
