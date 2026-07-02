---
title: "dump-rh: positions fetch and FolioFlow schema"
status: done
blocked_by:
  - 002-dump-rh-login-and-device-token
parent: prd-md/robinhood-portfolio-dump.md
---

## Parent

PRD: `prd-md/robinhood-portfolio-dump.md`

## What to build

A vertical slice that turns the authenticated session into the canonical Position array. After this slice:

- The Infrastructure adapter exposes `fetchPositions(token)` which calls the documented Robinhood positions endpoint and returns the raw JSON.
- The Application use case normalises that raw JSON into the FolioFlow-owned Position shape (symbol, quantity, average_buy_price, current_price, market_value, unrealised_pl, unrealised_pl_pct).
- Robinhood fields are mapped by the adapter, not the use case — the use case never sees a Robinhood field name.
- Fields Robinhood does not provide for a given position are emitted as `null`, not omitted. The shape is uniform.
- The CLI prints the normalised array to stdout (as a JSON line) in this slice. The file write is added in slice 4.

The slice is fully testable offline: tests mock the adapter with canned Robinhood-shaped JSON and assert that the use case returns the canonical shape, including the `null`-filling rules.

## Acceptance criteria

- [ ] `RobinhoodAdapter.fetchPositions(token)` returns the raw Robinhood positions JSON.
- [ ] The Application use case maps the raw JSON into the canonical Position shape documented in the PRD.
- [ ] Every Position has exactly the seven canonical fields, no more, no fewer.
- [ ] A field Robinhood omits is emitted as `null` (not undefined, not missing key).
- [ ] `unrealised_pl_pct` is computed by the use case from `unrealised_pl` and `market_value`, not just passed through.
- [ ] The CLI prints the JSON-serialised array to stdout in this slice, and only the array (no status line yet — that's slice 4).
- [ ] `index.test.js` covers: happy-path normalisation, `null`-filling for missing fields, and a case where Robinhood returns an unexpected field (the unexpected field is dropped, not echoed).
- [ ] No file is written to disk in this slice.

## Blocked by

- `002-dump-rh-login-and-device-token`
