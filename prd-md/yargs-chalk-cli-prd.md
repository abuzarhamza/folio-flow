## Problem Statement

The CLI entry point in `index.js` parses commands using raw `process.argv` positionals and flags, and emits all output via `console.log`/`console.error` with no styling. As the tool grows (single-symbol, `--sync-spy`, `--batch-spy`, future commands), ad-hoc argument parsing becomes brittle, the help text is nonexistent, and errors blend into normal stdout — making the tool harder to discover, debug, and extend.

## Solution

Replace the hand-rolled argument parsing with **yargs** subcommands (`rsi`, `sync-spy`, `batch-spy`) and add **chalk** for styled error/warning/help output. Success output remains plain JSON to preserve machine-readable composability.

## User Stories

1. As a CLI user, I want to invoke `node index.js rsi AAPL`, so that the command name reflects the intent (calculate RSI).
2. As a CLI user, I want to invoke `node index.js sync-spy` and `node index.js batch-spy`, so that bulk commands are first-class subcommands, not flags.
3. As a first-time user, I want `node index.js --help` to print a styled usage summary, so that I can discover available commands without reading source code.
4. As a first-time user, I want `node index.js rsi --help` to print usage for that subcommand, so that I know the expected argument.
5. As a CLI user, I want errors and warnings to render in red/yellow, so that they stand out from successful JSON output.
6. As a developer integrating downstream, I want successful command output to remain plain JSON, so that scripts can still pipe the result.
7. As a maintainer, I want the CLI to set a non-zero exit code on errors, so that shell pipelines and CI can detect failure.
8. As a maintainer, I want the argument parser to validate required arguments (e.g. `rsi` requires a symbol) before invoking services, so that the application layer never sees malformed input.
9. As a maintainer, I want new commands to be added by registering a new yargs handler, so that the surface area stays consistent.

## Implementation Decisions

- **Dependencies**: Add `yargs` and `chalk` as runtime dependencies. `yargs` handles parsing, subcommands, auto-help, and validation. `chalk` handles terminal coloring.
- **Subcommands** (replacing current positional/flag parsing):
  - `rsi <symbol>` — single-symbol RSI calculation (was: bare positional arg).
  - `sync-spy` — fetch S&P 500 holdings (was: `--sync-spy`).
  - `batch-spy` — bulk RSI for all S&P 500 tickers (was: `--batch-spy`).
  - `*` (default) — print help and exit non-zero.
- **Help text styling**: `chalk.cyan` for command/heading labels; `chalk.yellow` for example usage; plain text for descriptions.
- **Error styling**: `chalk.red` for fatal errors, `chalk.yellow` for warnings. All error output goes to `stderr` (yargs default).
- **Success output**: Plain `JSON.stringify` to `stdout`. No chalk. No banners.
- **Exit codes**: `0` on success, `1` on user error (missing arg, file not found), original code preserved for unhandled exceptions.
- **Strict mode**: yargs is configured with `.strict()` so unknown commands/flags fail loudly instead of being silently ignored.
- **Validation**: yargs `.check()` or `.demandCommand()` enforces required arguments before any service is called.
- **No changes** to `src/application/*`, `src/infrastructure/*`, or `src/domain/*`. This is a pure presentation-layer refactor.
- **No backwards-compatibility shims** for the old `--sync-spy` / `--batch-spy` flag style.

## Testing Decisions

- **What makes a good test**: Verify external CLI behavior — exit code, stdout JSON shape, stderr messages, help output presence. Do not test yargs internals or chalk color codes directly.
- **Seam**: `index.js` invoked as a child process via `child_process.execFileSync`. This is the highest seam and matches how real users run the tool.
- **Existing prior art**: Project uses Jest. Tests live alongside source as `*.test.js` or under a `tests/` directory.
- **Coverage**:
  - `rsi AAPL` exits 0 and emits valid JSON with `rsi_22`, `rsi_44`, `rsi_66` (or current shape).
  - `rsi` with no symbol exits non-zero and prints help to stderr.
  - `sync-spy` exits 0 and reports success JSON.
  - `batch-spy` without `snp500.json` exits non-zero with a red error message.
  - `--help` exits 0 and mentions all three subcommands.
  - Unknown command exits non-zero.
- **External IO**: Tests must not hit the real Yahoo Finance API. Use the same mocking strategy already established for `GetStockRSIs` / `BatchCalculateRSIs` (mock the infrastructure adapter).

## Out of Scope

- Interactive prompts, spinners, or progress bars.
- A config file (`.foliorc`) or env-var-based config.
- Backwards compatibility with the old positional/flag syntax.
- Restructuring into a `bin/` entry or publishing to npm.
- Shell completions.
- Localizing help text.

## Further Notes

- The decision to keep success output as plain JSON (no chalk) preserves the original `prd.md` invariant: *"I want the CLI output to be strictly in JSON format, so that I can reliably pipe the data into downstream bots."* Chalk is purely additive for human-facing messages (errors, warnings, help).
- The single existing reference PRD format `{"symbol": "AAPL", "rsi_22": 45.32, "rsi_44": 48.12, "rsi_66": 50.01}` is preserved unchanged.
- Future commands (`grill`, `analyze`, etc., as mentioned in the project roadmap) can be added as new subcommands by appending one `.command(...)` block.