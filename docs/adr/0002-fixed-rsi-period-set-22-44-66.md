# ADR-0002: Hard-code the RSI period set to {22, 44, 66}

- Status: Accepted
- Date: 2026-07-01
- Context: FolioFlow core

## Context

The Trader's stated strategy is a multi-horizon momentum read. Three time horizons are required: 22, 44, and 66. The PRD is explicit on this. `technicalindicators` can compute RSI for any period. We have to decide whether the periods are configurable.

## Decision

The set of Periods is **fixed** at exactly `{22, 44, 66}`. It is part of the RSI Result shape. There is no CLI flag, no environment variable, no config file, and no library option to change it. The output keys are literally `rsi_22`, `rsi_44`, `rsi_66` (and the derived `rsi_avg`).

## Consequences

Positive:
- The output JSON schema is stable and trivially parseable. Downstream bots can switch on the three keys.
- The Domain layer has no need for a Period collection abstraction — three constants are enough.
- The "warm-up" requirement (one year of daily closes) is derived once from the largest Period (66) and reused.

Negative:
- Any future request to add, remove, or change a period is a breaking schema change. That's the point.
- Consumers who want a different period set have to fork or post-process.

## Alternatives considered

- **Configurable periods via `--periods` / `getRSI(symbol, { periods })`.** Rejected: turns the RSI Result into an object of dynamic shape, breaks the Integrator's pipeline assumption, and adds zero value to the Trader, who is asking for this specific triple.
- **Configurable periods *plus* a default of `{22, 44, 66}`.** Rejected for the same reason — the default becomes a special case, and the schema stops being a contract.
