# ADR-0008: Remove the Robinhood integration

- Status: Accepted
- Date: 2026-07-05
- Context: FolioFlow — removal of the `dump-rh` subcommand and all associated code, tests, and documentation

## Context

ADR-0005 introduced a `folioflow dump-rh` subcommand that authenticated against `api.robinhood.com` (an undocumented, private API) and wrote the Trader's current open positions to `robinhood_portfolio.json`. ADR-0006 then hardened the at-rest token storage and added refresh-on-401. The integration shipped, the `FolioFlow.dumpRobinhoodPortfolio` library method and a set of typed `Robinhood*Error` subclasses landed, and the README and `CONTEXT.md` were updated to document the new terms.

In production, the integration has become unstable. Robinhood's private API has shifted in ways that defeat the hand-rolled adapter: auth endpoints rotate without notice, MFA challenges appear in new shapes, and the positions response is no longer parseable by the schema we pinned in ADR-0005. Running `folioflow dump-rh` reliably produces a red error, not a JSON file. Traders who see `dump-rh` listed in `--help` try to use it, get a failure, and assume FolioFlow as a whole is broken.

We are not replacing the integration with another broker in this slice. The decision here is removal, not substitution. A future ADR can add a different broker (Alpaca, Schwab, etc.) with a clean, broker-agnostic adapter shape informed by what we learned from this one.

## Decision

Delete the Robinhood integration from FolioFlow in its entirety:

- **Code.** Delete `src/application/DumpRobinhoodPortfolio.js`, `src/infrastructure/RobinhoodAdapter.js`, and `src/infrastructure/RobinhoodTokenStore.js`. Remove `FolioFlow.dumpRobinhoodPortfolio` from `index.js`, the `dump-rh` yargs command from `bin/folioflow.js`, the `dump-rh` switch from `src/cli.js`'s `run()` dispatcher, and the `Robinhood*Error` exports from `src/errors.js` and the package entrypoint.
- **Tests.** Delete `src/application/DumpRobinhoodPortfolio.error-propagation.test.js`, `src/infrastructure/RobinhoodAdapter.clientId.test.js`, `src/infrastructure/RobinhoodAdapter.test.js`, `src/infrastructure/RobinhoodTokenStore.test.js`, `src/cli.error-rendering.test.js`, and `src/errors.test.js`. Remove every Robinhood-specific case (and every Robinhood-specific mock / `jest.mock('./src/infrastructure/RobinhoodAdapter', …)`) from the surviving test files (`bin.test.js`, `index.test.js`, `index.module.test.js`). The CLI integration assertion that `--help` lists `dump-rh` is dropped; the new assertion is that `dump-rh` is *absent* from `--help`.
- **Documentation.** Move every Robinhood-specific glossary term (`Robinhood Portfolio`, `Position`, `Portfolio Dump`, `Robinhood Credentials`, `Access Token`, `Device Token Pair`, `Refresh Token`, `MFA Challenge`, `Robinhood Rate Limit`, the `DumpRobinhoodPortfolio` use case) out of the active section in `CONTEXT.md` and into a new `## Archived (Removed)` section. Remove the `dump-rh` examples and the "Robinhood Portfolio Dump" section from `README.md`. Mark ADR-0005 and ADR-0006 as **Deprecated** (rather than deleting them — they are the historical record of a feature that did ship).

The `plan` subcommand is left untouched. The `plan` input shape is the *Trader Portfolio* (English-cased, hand-curated), which is independent of any broker; it does not require the `dump-rh` output to function. Per the original `plan` ADR, the Trader manually maintains their portfolio JSON, full stop.

## Consequences

Positive:
- `--help` is honest: every listed subcommand works.
- The test suite is smaller, faster, and tests only reachable code paths.
- The error hierarchy is clean: the `Robinhood*Error` subclasses no longer exist as a permanent fork in the FolioFlow error tree.
- New contributors no longer see a "Robinhood" thread in `CONTEXT.md` and assume FolioFlow is a Robinhood client.
- The `Plan Signal` / `Top-20 Set` glossary is preserved exactly; nothing in the active ubiquitous language is affected by this slice.

Negative / acknowledged costs:
- **A feature is gone.** Any Trader who *was* running `dump-rh` against a stable Robinhood session now has no first-party FolioFlow path for that data. They fall back to a CSV export from Robinhood's web UI, or to a third-party tool.
- **Historical terms live in `CONTEXT.md` forever.** The `## Archived (Removed)` section will grow over time. This is the right call (history is data) but it does mean the glossary file stays longer than it otherwise would.
- **ADR-0005 and ADR-0006 are deprecated, not deleted.** They are kept as the historical record. A future reader looking up "why did we do this?" finds the original rationale in ADR-0005, the encryption follow-up in ADR-0006, and the removal decision here. The deprecation is visible on the front matter so a future reader cannot mistake them for guidance.
- **No replacement broker in this slice.** A future ADR can revisit this; the `plan` subcommand's broker-agnostic input shape means the rest of the system is ready for any broker we choose to add.

## Alternatives considered

- **Keep the feature, mark it "unsupported" in `--help` and stop running CI against it.** Rejected. "Documented as broken" is worse than "removed"; the help output still shows a command the Trader cannot use, and the source code still has to compile and load in every test.
- **Replace the integration with another broker in the same slice.** Rejected as out of scope. The PRD that drives this slice (`prd-md/remove-robinhood-prd.md`) is explicitly removal-only; a follow-up ADR can pick a replacement.
- **Wait for the Robinhood API to stabilise.** Rejected. The instability is structural, not transient — Robinhood's private API is undocumented by design, and there is no published support contract to wait on.
- **Move the integration to an optional, separately-installed companion package.** Considered. The maintenance cost of a sidecar npm package, a second README, and a separate issue tracker exceeds the maintenance cost of the broken code, especially given that no Trader currently has a working `dump-rh` to migrate. If a future broker integration is well-loved, *that* is the time to extract it.
