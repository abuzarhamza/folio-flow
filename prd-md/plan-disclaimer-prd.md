# PRD: "Not investment advice" disclaimer for `folioflow plan`

> Synthesised from the `/grill-with-doc` session on 2026-07-05. See `CONTEXT.md` for the ubiquitous language, ADR-0004 for the stdout-JSON / stderr-debug contract, and `prd-md/plan-example-file-prd.md` for the prior `plan` slice. Triage label requested: `ready-for-agent`.

## Problem Statement

`folioflow plan` produces `buy` / `sell` / `hold` signals for every row of a Trader's portfolio, but the README and CLI output carry no caveat that these signals are produced by a deterministic mechanical rule, not by a financial advisor. A Trader who runs `folioflow plan my_portfolio.json`, sees a `sell` signal on a position, and acts on it without consulting a licensed advisor has acted on a tool's output, not on advice — and the tool did not say so.

The Robinhood removal (ADR-0008) reduced FolioFlow's scope to two features: `rsi` (and `batch-spy`), which produce *data* (an RSI value, a sorted S&P 500 ranking), and `plan`, which produces *verdicts*. Only the verdict-producing feature needs a "not advice" disclaimer. The RSI features output numbers, not recommendations; their existing framing is fine.

The disclaimer must be visible at three moments: when the Trader reads the README (at-copy / at-evaluation time), when the Trader copies the worked example (at-start time), and when the Trader runs `folioflow plan` (at-action time). One surface is too easy to miss; a disclaimer on every line of output is over-engineered.

## Solution

Add a one-paragraph "not investment advice" disclaimer at four project surfaces, all of which currently say nothing on the topic. The wording is consistent across the four surfaces, the styling matches the existing project tone (no legalese, no boilerplate), and the slice is docs-and-stderr only — no new domain layer, no new error class, no change to the decision rule.

**Surfaces:**

1. **Project-wide README note** — a one-line blockquote under the H1, before the `## Features` section. Frames FolioFlow as a mechanical analysis tool.
2. **`### 4. Portfolio Plan` README blockquote** — the full two-sentence text, immediately under the H3, before the `Rule (v1)` bullets. Trader-specific framing.
3. **`docs/example-portfolio.NOTICE.txt`** — a sibling file next to the example JSON, with the same two-sentence text. The README's `cp` block grows a second `cp` command so the Trader copies the NOTICE alongside the JSON.
4. **CLI stderr** — `folioflow plan` emits the disclaimer in chalk-yellow on stderr, exactly once per run, immediately before the JSON status line on stdout. The chalk-yellow styling matches the existing "Warning:" pattern used by `batch-spy` for the missing-`snp500.json` case (ADR-0004: stdout is JSON, stderr is human).

**Test:** one new `it` block in `bin.test.js` that runs `folioflow plan valid-but-empty-array.json` and asserts the stderr output matches `/not financial advice/`. Same pattern as the existing `plan missing file` test (`/Error: Input file not found:/`).

The slice does not touch `CONTEXT.md`, the ADRs, the decision rule, the input shape, the `plan` CLI's argument handling, or the example JSON file. The disclaimer is a copy-and-stdout-layer concern.

## User Stories

1. As a Trader, I want a "not investment advice" disclaimer on the README's main page, so that I see it the moment I open the project, before I run any command.
2. As a Trader, I want a Trader-specific disclaimer at the top of the `### 4. Portfolio Plan` section, so that the caveat sits immediately next to the `Rule (v1)` description it qualifies.
3. As a Trader, I want the worked example's `cp` command to copy a NOTICE file alongside the JSON, so that I see the disclaimer at copy time, when I'm about to act on the example.
4. As a Trader, I want `folioflow plan` to print the disclaimer to stderr on every run, so that I see it at the moment of action, immediately before the JSON status line on stdout.
5. As a Trader, I want the stderr disclaimer to be styled in chalk-yellow (a warning, not an error), so that it is visually distinct from the red `Error:` lines I see when something goes wrong.
6. As a Trader, I want the disclaimer to be a short, plain-English sentence (or two), not a paragraph of legalese, so that I actually read it instead of skimming past it.
7. As a Trader, I want the same wording everywhere — README, NOTICE file, and CLI stderr — so that the message is recognisably the same regardless of where I encounter it.
8. As a maintainer, I want the disclaimer to be a single string constant in the CLI module, so that the wording is DRY across the stderr surface and easy to update in one place.
9. As a maintainer, I want the CLI to emit the disclaimer to stderr (not stdout), so that the stdout JSON contract (ADR-0004) is preserved and downstream tools piping `folioflow plan` into jq or other parsers are unaffected.
10. As a maintainer, I want a single integration test in `bin.test.js` that asserts the stderr contains the disclaimer substring, so that a future refactor that drops the line fails CI.
11. As a maintainer, I want no change to the decision rule, the input shape, the `FolioFlow.planPortfolio` library method, `CONTEXT.md`, or any ADR, so that this slice is provably a copy-and-stdout-layer concern and not a silent change to the project's domain model.
12. As a maintainer, I want the project-wide README note and the `### 4. Portfolio Plan` blockquote to be visually consistent (both as blockquotes, both short, both plain English), so that the README has a single voice on this topic.
13. As a maintainer, I want the chalk-yellow stderr line to be tested in the same `bin.test.js` describe block as the existing `plan` happy-path test, so that the existing `runBin` helper's `FORCE_COLOR: '0'` strips the ANSI and the test asserts on plain text.

## Implementation Decisions

- **Disclaimer text (canonical, used everywhere except the project-wide README note):** "Plan signals are a mechanical rule, not financial advice. Consult a licensed advisor before acting on them." Two short sentences, plain English, matches the README's existing voice.
- **Project-wide README note (shorter, project-wide framing):** "FolioFlow is a mechanical analysis tool. It does not provide financial advice." One sentence-pair, no Trader-specific language (the Trader-specific language lives in `### 4. Portfolio Plan`).
- **README surfaces use `>` Markdown blockquote syntax.** Matches the existing README style (no precedent for callout boxes; the existing code blocks and inline emphasis carry the visual weight).
- **CLI seam: `runPlan` in the presentation layer.** A single `console.error(chalk.yellow("..."))` call is added immediately before the `console.log(prettyJson(status, argv))` line. The chalk-yellow import is already in scope (the file uses chalk elsewhere) or pulled in via `require("chalk")` at the point of use, matching the existing `runBatchSPY` pattern.
- **Disclaimer string is defined once at module top** in the CLI file, then used by the `runPlan` function. No new file, no new config, no new constant export.
- **Example file is unchanged.** `docs/example-portfolio.json` stays pure JSON. The new `docs/example-portfolio.NOTICE.txt` is a sibling file, plain text, one line, the same wording as the CLI stderr line.
- **README's `cp` block grows a second command.** Currently: `cp docs/example-portfolio.json my_portfolio.json`. After: the same line, plus a `cp docs/example-portfolio.NOTICE.txt my_portfolio.NOTICE.txt` line and a one-line comment about reading the NOTICE first. Single contiguous block, no new section.
- **Test surface: `bin.test.js`.** One new `it` block in the existing `plan` describe area. Uses the existing `runBin` helper (which already returns stderr and already sets `FORCE_COLOR: '0'`). Asserts `result.stderr` matches `/not financial advice/`.
- **No test for the README notes.** The project-wide blockquote and the `### 4. Portfolio Plan` blockquote are static markdown; a future PR that drops one will be caught by a human reviewing the README diff. A grep test against a markdown file is a new pattern in this codebase, and the load-bearing behavior (the CLI stderr line at the moment of action) is already covered.
- **No test for the NOTICE file's contents.** Same reasoning: a one-line static file in the repo. A future PR that edits it is caught by review.
- **No change to `package.json` `files` array.** The new `docs/example-portfolio.NOTICE.txt` is in `docs/`, which is *not* in the current `files` array — only `docs/example-portfolio.json` was added by issue 016. The NOTICE.txt is docs, not a runtime artifact; it doesn't need to ship with `npm install`. The Trader who installs the package globally can read the README's blockquote; the Trader who clones the repo gets the NOTICE.txt from git.
- **No ADR.** A disclaimer is a copy decision, not an architectural decision. ADR-0004's stdout/stderr contract is already in scope; this slice is a single-line application of it.
- **No `CONTEXT.md` change.** The disclaimer is not a glossary term; it is a behavior of the `plan` subcommand's output. Glossary entries are facts about the domain; a disclaimer is a fact about how FolioFlow presents itself to the Trader. They don't share a slot.
- **No change to the decision rule, the `FolioFlow.planPortfolio` method, the input field set, or the example JSON file.** The slice is provably a presentation-layer concern.

## Testing Decisions

- **What makes a good test for this slice:** asserts the *external* contract (the disclaimer substring appears on stderr when `folioflow plan` is run) — not the *internal* details of the implementation (where the string is defined, what color it is, what comes before or after it on the line). The Trader's experience is the contract.
- **Test module: `bin.test.js`.** The existing integration test that spawns `node bin/folioflow.js` as a child process. The `runBin` helper already returns `{ code, stdout, stderr }` and already sets `FORCE_COLOR: '0'` so the chalk color is stripped from the captured stderr — the test asserts on plain text, not on ANSI escapes.
- **Prior art for the test pattern:** the existing `plan missing file` test in `bin.test.js` (`/Error: Input file not found:/`) and the `plan valid-but-empty-array` happy-path test. The new assertion follows the same shape: spawn the binary, capture stderr, regex-match a substring.
- **Assertion form:** `expect(result.stderr).toMatch(/not financial advice/)`. The substring is the unambiguous load-bearing phrase. Surviving minor rephrasing of the surrounding text means the test only fails if the core claim is dropped.
- **No negative-case test.** A test that asserts the disclaimer is *not* on stdout (i.e. that ADR-0004 is honored) is testing a different concern — that ADR already has the existing tests that assert the status line *is* on stdout. Adding a "and nothing else" assertion is testing absence, which is brittle.
- **Out of scope for testing:** reading the README or the NOTICE file from disk and asserting their contents. Those are static markdown/text files; a future PR is caught by review, not by test.

## Out of Scope

- Translating the disclaimer into other languages. Out of scope for v1; the project has no localisation infrastructure.
- Adding a `--no-disclaimer` flag to suppress the stderr line. The disclaimer is the cost of the feature; suppressing it is a footgun.
- A per-row `_disclaimer` field in `plan.json` output. Pollutes the JSON contract; the row is the signal, not a self-documenting artifact.
- A "ToS-style" multi-paragraph disclaimer (no warranty, no liability, etc.). Out of scope for a CLI utility; the one-sentence form is the right register.
- Extending the disclaimer to `rsi` and `batch-spy`. Those features produce data, not verdicts, and don't need it.
- Adding the disclaimer to the `CONTEXT.md` glossary. Glossary terms are domain concepts; a disclaimer is a presentation concern.
- A new ADR for the disclaimer. ADR-0004's stdout/stderr contract is already in scope.
- A `--disclaimer-path` config so a Trader can supply their own text. Out of scope; the wording is FolioFlow's, not the Trader's.

## Further Notes

- **Why no `CONTEXT.md` change:** the existing `Trader` glossary term describes who runs FolioFlow; the existing `Plan Signal` term describes the verdict. The disclaimer is a fact about *how FolioFlow presents the verdict*, not a fact about the verdict itself. It belongs in the README and the CLI, not the glossary.
- **Why no ADR:** ADR-0004 records that stdout is JSON and stderr is human. The disclaimer is a single-line application of that contract — chalk-yellow on stderr, immediately before the JSON status line. Recording "we added a one-sentence warning" would be noise.
- **Why no project-wide ADR like `0009-disclaimer-policy.md`:** an ADR is a decision the next maintainer needs context to understand. "We print a one-sentence warning" is not a decision the next maintainer will look at and wonder "why?". A README blockquote is the right surface.
- **Why the chalk-yellow is right, not chalk-red:** red is reserved for errors (the existing `Error:` rendering). Yellow matches the existing `Warning:` styling used by `runBatchSPY` for the missing-`snp500.json` case. The disclaimer is a warning, not an error — using red would overstate it and dilute the red signal for real errors.
- **Why once per `folioflow plan` run, not once per process:** `folioflow plan` is a one-shot CLI, not a long-running process. A Trader who scripts 100 `folioflow plan` invocations needs to see the disclaimer 100 times. A "once per process" optimisation protects a use case that doesn't exist.
- **Why the NOTICE.txt is in the repo but not in the npm package:** the Trader who installs the package via npm is shown the disclaimer by the README (which ships) and the CLI stderr (which fires on every run). The NOTICE.txt is for the Trader who clones the repo and reads the example file at copy time — that Trader is reading the README anyway, which already has the same text. Shipping the NOTICE.txt in the npm tarball would be belt-and-braces without adding protection.
- **Why the test asserts `/not financial advice/`, not the full sentence:** the substring is the load-bearing claim. A future maintainer who edits the surrounding text ("Consult a licensed advisor before acting on them" → "Talk to a financial professional before trading") should not have to update the test. The substring survives any rephrasing that preserves the core claim.
- **The Trader's workflow after this ships:** opens the README, sees the project-wide disclaimer under the H1, scrolls to `### 4. Portfolio Plan`, sees the Trader-specific blockquote, runs `cp docs/example-portfolio.json my_portfolio.json` and `cp docs/example-portfolio.NOTICE.txt my_portfolio.NOTICE.txt`, reads the NOTICE, edits the JSON, runs `folioflow plan my_portfolio.json`, sees the chalk-yellow line on stderr, then the JSON status line on stdout. The disclaimer is unmissable.
