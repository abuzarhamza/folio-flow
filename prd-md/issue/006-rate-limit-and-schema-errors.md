---
title: "dump-rh: rate-limit and schema-drift errors"
status: done
blocked_by: []
parent: prd-md/dump-rh-refresh-and-encrypted-token-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/dump-rh-refresh-and-encrypted-token-prd.md`

## What to build

A thin vertical slice that adds two new typed errors to the FolioFlow error hierarchy and wires them through the Robinhood adapter and CLI. After this slice:

- `RobinhoodRateLimitError` and `RobinhoodSchemaError` exist as `FolioFlowError` subclasses and are re-exported from the package entrypoint.
- `RobinhoodAdapter.fetchPositions` maps an upstream 429 response to `RobinhoodRateLimitError` and an unparseable top-level response shape to `RobinhoodSchemaError`.
- The CLI renders a `RobinhoodRateLimitError` with a chalk-yellow "please retry in a few minutes" message on stderr (warning, not error), distinct from the existing chalk-red credential errors. A `RobinhoodSchemaError` renders as chalk-red with the message "Robinhood response shape changed; please report this error."
- The library surface (`FolioFlow.dumpRobinhoodPortfolio`) throws the same typed errors so Node consumers can `try/catch` on the exact subclass.

This slice ships **no token-store, no refresh, no encryption**. It is a prerequisite for the other slices because both depend on the new error classes. It is the smallest possible slice that proves the error taxonomy is sound end-to-end.

## Acceptance criteria

- [ ] `src/errors.js` exports `RobinhoodRateLimitError` and `RobinhoodSchemaError`, each `extends FolioFlowError`.
- [ ] `index.js` re-exports both new error classes.
- [ ] `RobinhoodAdapter.fetchPositions` throws `RobinhoodRateLimitError` when the upstream response is HTTP 429.
- [ ] `RobinhoodAdapter.fetchPositions` throws `RobinhoodSchemaError` when the upstream response is neither a bare array nor an object with a `results` array.
- [ ] `RobinhoodAdapter.fetchPositions` accepts both the bare-array and `{ results: [...] }` shapes.
- [ ] `RobinhoodAdapter` constructor accepts an `httpClient` injection option (a function `(path, init) => Promise<{ status, body }>`) for testability. The default `httpClient` uses native `fetch`.
- [ ] `cli.runDumpRH` catches `RobinhoodRateLimitError` separately and renders it in chalk-yellow.
- [ ] `cli.runDumpRH` catches `RobinhoodSchemaError` separately and renders it in chalk-red.
- [ ] New `RobinhoodAdapter.test.js` covers: 429 → `RobinhoodRateLimitError`, malformed response → `RobinhoodSchemaError`, both accepted shapes return parsed arrays.
- [ ] `DumpRobinhoodPortfolio.test.js` extends with: 429 bubbles as `RobinhoodRateLimitError`, schema drift bubbles as `RobinhoodSchemaError`.
- [ ] `index.test.js` extends with one CLI integration case that triggers each new error and asserts the correct stderr colour and message prefix.
- [ ] No production code path touches the network in this slice (all tests use the injected `httpClient`).
- [ ] All previously-passing tests still pass.

## Blocked by

None — can start immediately.
