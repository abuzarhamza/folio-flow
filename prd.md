## Problem Statement

The problem that the user is facing is that they need a way to quickly calculate Relative Strength Index (RSI) for specific periods (22, 44, and 66) for any given stock symbol to support a momentum-based trading strategy. Currently, calculating this specific combination of indicators manually or retrieving them from various platforms can be cumbersome and error-prone, slowing down analysis.

## Solution

A fast, reliable CLI tool built with Node.js that accepts a stock symbol, fetches the last 1 year of historical daily data, computes the RSIs using the `technicalindicators` package, and outputs the result in JSON format. The application is architected following a simple 4-layer Domain-Driven Design (DDD) to cleanly separate concerns.

## User Stories

1. As a momentum trader, I want to execute a CLI command with a stock symbol, so that I can instantly get its RSI indicators.
2. As a technical analyst, I want the CLI output to include RSI periods of 22, 44, and 66, so that I rely on multiple time horizons to evaluate momentum signals.
3. As a developer integrating tools, I want the CLI output to be strictly in JSON format, so that I can reliably pipe the data into downstream bots or analytical scripts.
4. As a CLI user, I want the tool to elegantly handle network errors or invalid stock symbols, so that I can understand what went wrong without reading verbose stack traces.
5. As a system maintainer, I want the application code to follow DDD principles (Domain, Infrastructure, Application, Presentation), so that it is easy to test, adapt, or swap out the data provider (Yahoo Finance) in the future.

## Implementation Decisions

- The architecture will strictly follow Domain-Driven Design (DDD) using four layers.
- **Domain Context**: Will define the core models (e.g., the structure of an RSI Result) and business rules.
- **Infrastructure Context**: Will contain an adapter wrapping the external dependency `yahoo-finance2`. This adapter will fetch 1 year of historical closing prices in order to establish a sufficient "warm-up" period for the 66-period RSI calculation.
- **Application Context**: Will contain the `GetStockRSIs` service/use case. It will orchestrate fetching the prices via the infrastructure adapter, feed them to `technicalindicators` arrays for lengths 22, 44, and 66, and extract only the final current value for each.
- **Presentation Context**: The root `index.js` will act as a thin CLI wrapper. It takes the target symbol string as an argument, invokes the application service, and prints the generated JSON payload. Errors thrown by the application layer will be caught here and formatted cleanly.

## Testing Decisions

- A good test in this project will interact with the system via its highest practical seam, focusing on external behaviors and use-case outcomes rather than isolating internal logic.
- **Testing Seam**: The highest seam we will test is the the Application Service (`GetStockRSIs`). This is because the presentation layer (`index.js`) is an exceptionally thin wrapper solely responsible for `console.log`.
- **Mocking Ext. IO**: When testing the application service, the Infrastructure layer adapter that wraps `yahoo-finance2` will be replaced with a mock implementation. This ensures test reliability and prevents actual network requests while validating that the RSI indicators are computed cleanly.
- Tests will cover edge cases such as missing data, invalid symbols, and Yahoo Finance network timeouts.

## Out of Scope

- An interactive CLI wizard or visual dashboards; execution must act entirely via standard positional arguments.
- Continuous streaming of real-time RSI updates.
- Implementing other technical indicators beyond RSI (e.g., MACD, EMA).
- Integrating a local database persistency layer to cache fetched ticker results.

## Further Notes

- The decision to enforce JSON output guarantees script composability. Format: `{"symbol": "AAPL", "rsi_22": 45.32, "rsi_44": 48.12, "rsi_66": 50.01}`.
