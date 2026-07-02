## Problem Statement

Users analyzing the massive output array generated for the S&P 500 (`spy_rsi_results.json`) or checking individual stocks currently must mentally calculate or run external spreadsheet macros to visualize the macro momentum aggregate of a stock. There is no unified snapshot indicator that summarizes all three horizons into a single momentum grade.

## Solution

Calculate a newly integrated `rsi_avg` variable representing the arithmetic mean of `rsi_22`, `rsi_44`, and `rsi_66`. This calculation will be directly implanted into the Application tier so that both standard single-symbol queries and JSON batch processes gain the metric securely.

## User Stories

1. As a momentum trader evaluating output files, I want to see an `rsi_avg` JSON property so I can immediately sort stocks by unified momentum rather than guessing weighted horizons.
2. As a script consumer, I want the `rsi_avg` reliably scoped to exactly 2 decimal places to maintain consistency with isolated metrics.
3. As a developer feeding IPOs or recent listings deeply into the array, I want the algorithm to gracefully fallback and supply the average of *available* metrics instead of failing the schema object or outputting `null` strictly because `rsi_66` data points don't exist yet.

## Implementation Decisions

- **Domain Scope**: The variable modification happens entirely inside `src/application/GetStockRSIs.js` mutating the returned object payload structure. 
- **Graceful Fallback**: The logic will filter out `null` or `NaN` attributes representing invalid RSIs and calculate the mean over the remaining strict `Number` occurrences.
- **Precision Limits**: Applying `Number(...).toFixed(2)` onto the final mean strictly enforcing mathematical formatting limitations safely.

## Testing Decisions

- **Testing Seam**: Execute unit-testing logic directly against `src/application/GetStockRSIs.test.js`.
- Provide complete mock data confirming accurate computation mapping. 
- Provide deeply restricted mock data (i.e., only allowing calculation up to `rsi_44`) to enforce coverage checking the fallback-average logic dynamically adjusting the divisor.

## Out of Scope

- Applying weighted average values (e.g. giving mathematically higher precedence to recent 22-day variables over 66-day ones). The calculation resolves exclusively through unweighted strict arithmetic mean structure.
