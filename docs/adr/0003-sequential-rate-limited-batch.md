# ADR-0003: Sequential batch processing with a fixed inter-request delay

- Status: Accepted
- Date: 2026-07-01
- Context: FolioFlow Batch Run

## Context

A Batch Run over the S&P 500 means ~500 fetches against Yahoo Finance, sequenced through a single residential-class IP. Yahoo Finance will rate-limit or block an IP that fires requests too quickly, which would corrupt the Batch Run's output. We have to pick a concurrency model.

## Decision

`BatchCalculateRSIs` processes Symbols **sequentially** with a fixed inter-request delay (a "Rate-Limited Window"). There is no parallel fan-out, no worker pool, and no dynamic backoff. The delay is the only mechanism that keeps the system under the provider's threshold.

A Symbol's `GetStockRSIs` call is awaited to completion (so the RSI Result is in hand) before the next Symbol's fetch is started. Failures on individual Symbols are surfaced as errors and do not stop the Batch Run, but they do consume their own time slot.

## Consequences

Positive:
- A Batch Run is predictable. With ~500 symbols and a 1-second delay, the Trader knows the run takes roughly 8+ minutes end-to-end.
- No concurrency primitives, no shared state, no race conditions. The Application layer reads as a straight-line `for` loop over the Symbols.
- Per-IP throttling is a property of the implementation, not a property the Trader has to think about.

Negative:
- Wall-clock time is linear in the number of Symbols. A run that could finish in ~1 minute at 8× concurrency takes ~8 minutes. We accept this.
- The fixed delay is a guess at the provider's threshold. If the threshold changes, the delay has to be updated.

## Alternatives considered

- **Parallel fan-out with a small pool (e.g. 4–8 concurrent).** Rejected: turns the Batch Run into a system with non-deterministic ordering, partial failures, and harder-to-reason-about rate-limit behaviour. The Trader does not need the speed.
- **Dynamic backoff on HTTP 429.** Rejected as the *primary* mechanism: a 429 means we already burned a request budget. The fixed delay is preventive; backoff is reactive, and reactive is too late on a 500-symbol run.
- **Cached results across runs.** Explicitly out of scope per the PRD; revisit only if the Batch Run becomes too slow to be useful.
