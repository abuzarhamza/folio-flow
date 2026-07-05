---
title: "remove: Robinhood Code & Tests (Core + CLI)"
status: done
blocked_by: []
parent: prd-md/remove-robinhood-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/remove-robinhood-prd.md`

## What to build

This vertical slice removes the Robinhood integration entirely from the codebase. It deletes the application service, infrastructure adapters, and all associated tests. It also removes the CLI command, library method, and specific error classes.

## Acceptance criteria

- [ ] `src/application/DumpRobinhoodPortfolio.js` is deleted.
- [ ] `src/infrastructure/RobinhoodAdapter.js` and `src/infrastructure/RobinhoodTokenStore.js` are deleted.
- [ ] All Robinhood-specific test files are deleted (`DumpRobinhoodPortfolio.error-propagation.test.js`, `RobinhoodAdapter.clientId.test.js`, `RobinhoodAdapter.test.js`, `RobinhoodTokenStore.test.js`).
- [ ] `FolioFlow.dumpRobinhoodPortfolio` is removed from `index.js`.
- [ ] Robinhood-specific error classes (e.g., `RobinhoodAuthError`) are removed from `index.js` and `src/errors.js`.
- [ ] `dump-rh` command is removed from `bin/folioflow.js`.
- [ ] `runDumpRH` and its routing is removed from `src/cli.js`.
- [ ] `bin.test.js` and `index.module.test.js` no longer contain tests for the `dump-rh` command or Robinhood behavior.
- [ ] The test suite (`npm run test`) passes with no skipped or failing tests.

## Blocked by

None - can start immediately
