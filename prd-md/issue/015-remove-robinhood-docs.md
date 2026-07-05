---
title: "remove: Robinhood Documentation & ADR Cleanup"
status: done
blocked_by:
  - 014-remove-robinhood-code
parent: prd-md/remove-robinhood-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/remove-robinhood-prd.md`

## What to build

This vertical slice updates the project documentation and ADRs to reflect the removal of the Robinhood integration.

## Acceptance criteria

- [ ] `CONTEXT.md` moves all Robinhood-specific terms to a new `## Archived (Removed)` section to preserve historical context without cluttering active terminology.
- [ ] `README.md` has the "Robinhood Portfolio Dump" section removed.
- [ ] `docs/adr/0005-robinhood-portfolio-dump.md` and `docs/adr/0006-encrypted-device-token-pair.md` have their Status changed to "Deprecated".
- [ ] `docs/adr/0008-remove-robinhood-integration.md` is created to document the removal decision.

## Blocked by

- 014-remove-robinhood-code
