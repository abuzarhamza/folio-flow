## What to build

Implement the `--sync-spy` command framework. This requires creating the `SPYHoldingsAdapter` in the Infrastructure layer. The adapter should download the official `.xlsx` holdings file from State Street and parse the constituent ticker symbols using the `xlsx` library. The Application layer should then save this array of symbols to a local `snp500.json` file. Finally, wire up `index.js` to recognize the `--sync-spy` flag and execute this pipeline.

## Acceptance criteria

- [x] The `xlsx` package is installed and used to parse the State Street Excel sheet.
- [x] Running `node index.js --sync-spy` successfully deposits `snp500.json` in the project root containing an array of S&P 500 ticker strings.
- [x] Appropriate unit tests exist for parsing utilizing a dummy mocked Excel buffer structure.

## Blocked by

- None - can start immediately
