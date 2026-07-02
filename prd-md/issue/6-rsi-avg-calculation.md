## What to build

Implement the functionality to generate an `rsi_avg` metric globally. Modify `src/application/GetStockRSIs.js` so it dynamically calculates the arithmetic mean `(rsi_22 + rsi_44 + rsi_66) / 3` returning a strict float string bounded to two decimal places.

If the incoming array contains `undefined` or `NaN` properties (e.g., a stock younger than 66 days), gracefully omit it when formulating the mean. Ensure these calculations are securely unit tested verifying basic math alongside null constraints via dummy Jest configurations.

## Acceptance criteria

- [x] Single symbol executions result in payload including `"rsi_avg": XX.XX`.
- [x] Values accurately mimic expected arithmetic means.
- [x] Fallback calculations do not crash but restrict divisor calculations avoiding variables without history blocks.
- [x] Mocked Unit Tests passing inside `GetStockRSIs.test.js` validating the math and fallback behavior.

## Blocked by

- None - can start immediately
