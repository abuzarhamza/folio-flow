---
title: "plan: documentation and ADR cross-references"
status: ready
blocked_by:
  - 010-plan-core-service-and-cli-render
  - 011-plan-failure-modes
  - 012-plan-yargs-wiring
parent: prd-md/portfolio-plan-prd.md
triage: ready-for-agent
---

## Parent

PRD: `prd-md/portfolio-plan-prd.md`

## What to build

A vertical slice that documents the new subcommand for the Trader and the maintainer. After this slice:

- `README.md` has a new "5. Portfolio Plan" section that documents: the input file shape (the 6 English-cased fields), the top-20 reference set, the buy/sell/hold rule, the output shape (input superset + `signal` + `reason`), the `plan.json` file, and a worked example.
- `docs/adr/0007-portfolio-plan.md` exists and captures the rationale for the locked design: the top-20 set is the first 20 in `snp500.json`, the input fields are English-cased (not snake_case), `Equity attribute` is recorded but not acted on by the v1 rule, and there is no automatic integration with `dump-rh`.
- The PRD (`prd-md/portfolio-plan-prd.md`) is unchanged; this slice references the new ADR rather than duplicating its content.
- `CONTEXT.md` already contains the four new glossary entries (`Trader Portfolio`, `Equity Attribute`, `Plan Signal`, `Top-20 Set`) added during the design grill — this slice confirms that the file is in the expected state.

This slice ships no production code and no tests. It is the documentation closing slice and follows the same pattern as the dump-rh slice 009.

## Acceptance criteria

- [ ] `README.md` has a "5. Portfolio Plan" section parallel to the existing 4 sections, with: input file shape, top-20 reference set, buy/sell/hold rule, output shape, `plan.json` file, and a worked example.
- [ ] `docs/adr/0007-portfolio-plan.md` exists with the standard ADR format (Status: Accepted, Date, Context, Decision with shape, Consequences, Alternatives considered). The decision section covers: top-20 set as the first 20 in `snp500.json`, English-cased field names, no integration with `dump-rh`, `Equity attribute` recorded but not consumed by the rule.
- [ ] `CONTEXT.md` contains the four new glossary entries: `Trader Portfolio`, `Equity Attribute`, `Plan Signal`, `Top-20 Set`. (Verify, do not re-add.)
- [ ] No production code is changed in this slice.
- [ ] All previously-passing tests still pass.

## Blocked by

- `010-plan-core-service-and-cli-render`
- `011-plan-failure-modes`
- `012-plan-yargs-wiring`
