# ADR-0004: Strict stdout/stderr split — JSON to stdout, diagnostics to stderr

- Status: Accepted
- Date: 2026-07-01
- Context: FolioFlow Presentation

## Context

The CLI's primary value is **script composability**: the Trader pipes FolioFlow's output into `jq`, into a bot, or into another script. That means `stdout` must be exactly the result payload, byte for byte, and nothing else. At the same time, Batch Runs are long enough that the Trader needs progress visibility (queue position, fetch timing, which Symbol is being processed) without breaking the output contract.

## Decision

`stdout` is reserved exclusively for the result payload — one of:
- the RSI Result JSON for `rsi <symbol>`,
- the sync status JSON for `sync-spy`,
- the Batch Run results JSON for `batch-spy`.

`stderr` is reserved for:
- `chalk`-styled error messages (Presentation-level `Error:` lines),
- `debug`-namespaced diagnostic traces routed through the `debug` package under the `folioflow:*` namespace.

The `debug` package is configured (by convention) to write to `stderr`, so any `debug('folioflow:batch')(...)` call never reaches `stdout`. The Batch Run's progress is observable by setting `DEBUG=folioflow:batch` (or `folioflow:*`).

The library API (`FolioFlow.getRSI`, `syncSPYHoldings`, `runBatchRSIs`) does not print at all. It returns values and throws. `console.log` is only called from the Presentation layer's CLI dispatcher.

## Consequences

Positive:
- `folioflow rsi AAPL | jq .rsi_22` works in a shell pipeline with no surprise text.
- The Trader can opt into verbose traces without changing the output schema.
- Errors are visible but stylistically distinct from the result payload, so a consumer can `2>/dev/null` to silence them.

Negative:
- Library consumers who want to see the same progress output that the CLI sees have to opt in by setting `DEBUG` themselves. Acceptable — they're a different audience from the Trader.
- A misuse (someone `console.log`-ing from Application or Infrastructure) would silently break the contract. Mitigated by code review and the rule that only Presentation writes to stdout.

## Alternatives considered

- **Single-stream JSON envelope with `kind: "result" | "progress" | "error"`.** Rejected: turns a CLI into a parser's problem, and the Trader's eyes are the primary consumer of progress output, not a downstream script.
- **Spinners and TUI on stderr via something like `ora`.** Rejected as overkill: the Batch Run's 8-minute duration is fine as plain `debug` lines, and a TUI breaks the "headless" assumption of many CI/automation contexts where this CLI is also used.
