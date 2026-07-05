## Problem Statement

The Robinhood API is an undocumented, private API that has become unstable and is no longer working reliably for our integration. As a result, the `dump-rh` subcommand in FolioFlow is broken and causing confusion for Traders. Keeping dead code around adds maintenance burden and pollutes the domain model and CLI help outputs with a feature that no longer functions.

## Solution

Remove the Robinhood integration entirely from FolioFlow. This includes removing the `dump-rh` CLI command, the associated Application services and Infrastructure adapters, and all related tests. We will also update our documentation to reflect this removal: archiving Robinhood-specific glossary terms in `CONTEXT.md`, and formally deprecating the ADRs that governed the Robinhood design, replacing them with a new ADR documenting the removal.

## User Stories

1. As a Trader, I want the `dump-rh` command removed from the CLI help output, so that I am not misled into trying to use a broken feature.
2. As a Trader, I want the `folioflow dump-rh` command to return a clear "command not found" or yargs usage error, so that I know the feature is no longer supported.
3. As a Maintainer, I want all Robinhood-specific Infrastructure code (`RobinhoodAdapter`, `RobinhoodTokenStore`) deleted, so that I don't have to maintain or test dead code.
4. As a Maintainer, I want the `DumpRobinhoodPortfolio` Application service deleted, so that the application layer accurately reflects current capabilities.
5. As a Maintainer, I want all Robinhood-specific error classes (e.g., `RobinhoodAuthError`, `RobinhoodRateLimitError`, `RobinhoodSchemaError`, `RobinhoodTokenStoreError`) removed from the system, so that the error hierarchy is clean and relevant.
6. As a Maintainer, I want Robinhood-specific tests deleted, so that the test suite runs faster and doesn't test unreachable code.
7. As a Maintainer, I want Robinhood-related glossary terms moved to an "Archived" section in `CONTEXT.md`, so that the historical context is preserved without cluttering the active ubiquitous language.
8. As a Maintainer, I want ADR 0005 and ADR 0006 marked as "Deprecated" and a new ADR created to document the removal, so that future developers understand why the integration was removed.

## Implementation Decisions

- **Code Removal**:
  - Delete `src/application/DumpRobinhoodPortfolio.js`
  - Delete `src/infrastructure/RobinhoodAdapter.js`
  - Delete `src/infrastructure/RobinhoodTokenStore.js`
  - Delete `src/application/DumpRobinhoodPortfolio.error-propagation.test.js`
  - Delete `src/infrastructure/RobinhoodAdapter.clientId.test.js`
  - Delete `src/infrastructure/RobinhoodAdapter.test.js`
  - Delete `src/infrastructure/RobinhoodTokenStore.test.js`
- **Interfaces Modified**:
  - Remove `dumpRobinhoodPortfolio` from `FolioFlow` class in `index.js`.
  - Remove Robinhood error exports from `index.js` and `src/errors.js`.
  - Remove `dump-rh` routing in `src/cli.js`.
  - Remove `dump-rh` command from `bin/folioflow.js` yargs config.
- **Documentation**:
  - `CONTEXT.md`: Move terms like `Robinhood Portfolio`, `Position`, `Portfolio Dump`, `Robinhood Credentials`, `Access Token`, `Device Token Pair`, `Refresh Token`, `MFA Challenge`, `Robinhood Rate Limit` to an `## Archived (Removed)` section.
  - `README.md`: Remove the "Robinhood Portfolio Dump" section.
  - `docs/adr/0005-robinhood-portfolio-dump.md` & `0006-encrypted-device-token-pair.md`: Change Status to "Deprecated".
  - `docs/adr/0008-remove-robinhood-integration.md`: Create new ADR documenting the removal.

## Testing Decisions

- The removal will be verified by ensuring the test suite passes after the code and tests are deleted.
- Existing tests in `bin.test.js` and `index.module.test.js` that mock or assert Robinhood behavior will be deleted or modified to remove references to Robinhood.
- We will verify that `folioflow --help` no longer lists `dump-rh`.

## Out of Scope

- Modifying the `plan` subcommand. The `plan` command already expects a generic JSON file and its design correctly decoupled it from Robinhood. No code changes are needed there.
- Adding a replacement broker integration (e.g., Alpaca or Schwab). This PRD focuses purely on removal.

## Further Notes

- The decision to keep the terms in an "Archived" section of `CONTEXT.md` rather than deleting them entirely respects the project's history and explains to any returning contributors what happened to the domain language.
