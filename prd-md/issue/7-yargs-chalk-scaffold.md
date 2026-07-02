## Parent

prd-md/yargs-chalk-cli-prd.md

## What to build

Scaffold the yargs + chalk foundation in `index.js` (Presentation layer). Install `yargs` and `chalk` as runtime dependencies. Register three subcommand placeholders (`rsi`, `sync-spy`, `batch-spy`) whose handlers may throw "not yet implemented". Enable yargs `.strict()` mode, `.demandCommand()`, and auto-generated `--help` styled with chalk (cyan headings, yellow examples). Configure an `epilogue` with project description. Unknown commands must exit non-zero with a red error. No domain, application, or infrastructure code is touched. No backwards compatibility with old positional/flag syntax.

## Acceptance criteria

- [x] `yargs` and `chalk` are listed in `package.json` `dependencies` and installed.
- [x] `node index.js --help` prints a styled usage summary listing all three subcommands and exits 0.
- [x] `node index.js rsi --help` prints usage for the `rsi` subcommand and exits 0.
- [x] `node index.js <unknown-command>` exits non-zero and prints a red error to stderr.
- [x] `node index.js` with no arguments exits non-zero and prints help.
- [x] All existing `src/application/*` and `src/infrastructure/*` files are unchanged.
- [x] No reference to `--sync-spy` or `--batch-spy` flag style remains anywhere in the repo.

## Blocked by

None - can start immediately