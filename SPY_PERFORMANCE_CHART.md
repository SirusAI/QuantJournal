# SPY performance and gap charts

These Reports charts group the selected trades by SPY's movement on the same exchange trading date. This document contains no personal performance statistics or account records.

## Data flow

`ReportsView` passes the filtered trades to `SpyPerformanceChart` and `SpyGapChart`. The shared `JournalClient` loads daily OHLC data through `getSpyDaily`.

- The local adapter calls `/api/spy-daily`, which uses the user's selected daily `MarketDataProvider`: yfinance, Massive, or custom HTTP.
- The public demo adapter returns deterministic synthetic bars from its fictional fixtures. It does not contact a provider.
- Each response identifies its source, interval, coverage and price-adjustment basis. Missing or unavailable data produces a visible explanation.

## Calculations

Daily movement is `(close - open) / open × 100`. The overnight gap is `(today's open - previous trading day's close) / previous trading day's close × 100`.

Each chart uses the same eight movement buckets: below −3%, −3% to −2%, −2% to −1%, −1% to 0%, 0% to 1%, 1% to 2%, 2% to 3%, and at least 3%. Matched trade records supply net P&L, trade counts and win/loss counts. The chart can summarize the correlation between matched observations; it does not infer causation or predict returns.

The gap chart requests additional earlier dates to obtain the previous trading day's close. It skips comparisons when the needed prices are missing. Filters affect the trades used in each calculation. Local charts use the actual imported quantities, fees and P&L.

## Source files

- `components/spy-performance-chart.tsx`
- `components/spy-gap-chart.tsx`
- `components/reports-view.tsx`
- `app/api/spy-daily/route.ts`
- `lib/journal-client.ts`, `lib/market-data.ts`, and `demo/market.ts`

Configure your own market connection in Settings. Keys remain in the ignored local credential store. The local application never replaces a provider failure with random prices.
