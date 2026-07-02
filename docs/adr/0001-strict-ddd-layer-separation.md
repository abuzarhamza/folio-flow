# ADR-0001: Strict four-layer DDD architecture

- Status: Accepted
- Date: 2026-07-01
- Context: FolioFlow core

## Context

FolioFlow's domain logic (computing RSIs from Historical Prices) is small, but it sits on top of two unstable external systems — Yahoo Finance for prices and State Street for SPY Holdings — and exposes two different surfaces (a CLI and a Node module). Without an explicit layer boundary, tests would have to hit the network, swapping providers would be a refactor, and the CLI's `stdout` contract would be at risk of contamination from diagnostic logging.

## Decision

Adopt a strict four-layer DDD split with one-way dependencies. The Presentation layer may not know about Infrastructure. The Application layer may not import from a third-party SDK directly. The Domain layer is pure.

- **Presentation** — `bin/folioflow.js`, `index.js`, `src/cli.js`. Parses argv, prints JSON, formats errors. No business logic.
- **Application** — `src/application/`. Use cases (`GetStockRSIs`, `BatchCalculateRSIs`) that orchestrate domain computation and call into Infrastructure through interfaces only.
- **Domain** — Pure types and calculations. No I/O. No third-party imports from the outside world.
- **Infrastructure** — `src/infrastructure/`. Adapters that wrap `yahoo-finance2` and the State Street `.xlsx`. They implement the interfaces the Application layer depends on.

The `FolioFlow` class in `index.js` is a thin composition root: it wires adapters to services and exposes `getRSI`, `syncSPYHoldings`, `runBatchRSIs`.

## Consequences

Positive:
- The Application seam is the highest practical test seam (per the Testing Decisions in `prd.md`); mocking the Infrastructure adapter is enough to test every use case offline.
- Swapping Yahoo Finance for another provider is a single-file change in Infrastructure.
- The CLI stays side-effect-free as a library — `require('folioflow')` never prints, never exits.

Negative:
- A small amount of ceremony for a small system. A two-file change often needs to add or update a constructor parameter.
- The strictness is enforced socially (PR review), not by tooling.

## Alternatives considered

- **Flat structure with services.** Rejected: would have made the provider swap a cross-cutting change, and the library/CLI split would have leaked.
- **Hexagonal/ports-and-adapters with explicit port interfaces in `src/domain/ports/`.** Rejected as overkill for the current size; the same effect is achieved by constructing services with adapter dependencies. Can be promoted later if a second adapter ever lands.
