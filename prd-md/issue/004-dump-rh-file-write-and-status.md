---
title: "dump-rh: file write and CLI status payload"
status: done
blocked_by:
  - 003-dump-rh-positions-fetch-and-schema
parent: prd-md/robinhood-portfolio-dump.md
---

## Parent

PRD: `prd-md/robinhood-portfolio-dump.md`

## What to build

A vertical slice that completes the on-disk artifact and the CLI status contract. After this slice:

- The CLI writes `./robinhood_portfolio.json` in the current working directory, fully replaced on every run.
- The file shape is `{ "asOf": "<ISO-8601>", "positions": [...] }`. The `asOf` timestamp is captured at the moment the adapter returns, not at command start.
- stdout carries a one-line JSON status payload mirroring `sync-spy` and `batch-spy`: `{"status":"success","positionsCount":<n>,"file":"robinhood_portfolio.json"}`.
- The library API (`ff.dumpRobinhoodPortfolio`) continues to return the array directly and does **not** write to disk. Disk IO is owned by the Presentation layer, per the existing project convention.

The slice is fully testable offline: tests mock the adapter, run `node index.js dump-rh` via the existing integration seam, and assert on the file contents and the stdout status line.

## Acceptance criteria

- [ ] `folioflow dump-rh` writes `./robinhood_portfolio.json` in the working directory.
- [ ] The file shape is exactly `{ "asOf": <ISO-8601 string>, "positions": <Position[]> }`.
- [ ] The file is replaced on every run (not appended, not merged).
- [ ] The `asOf` timestamp reflects the moment the adapter returned, not command start.
- [ ] stdout carries the one-line JSON status payload exactly matching the shape used by `sync-spy` and `batch-spy`.
- [ ] `ff.dumpRobinhoodPortfolio(...)` returns the array and does not touch the filesystem.
- [ ] `index.test.js` covers: file written with the correct shape, file replaced on second run, `asOf` present and ISO-8601, stdout status payload matches the existing convention, library API does not write a file (asserted via a separate test that doesn't mock fs).

## Blocked by

- `003-dump-rh-positions-fetch-and-schema`
