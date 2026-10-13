# Manual acceptance checks

1. Run npm ci and npm run setup in a fresh copy. Dashboard, Calendar, Reports, Trades, Journal and Daily Review should show empty states.
2. Add a synthetic trade, edit executions and notes, apply a custom tag, and save a journal note. Confirm real quantities, fees and P&L agree across views.
3. Configure your own AI connection. Test it, enter or refresh a model ID, and assign defaults to all three AI features. Generate and reopen reviews. Test an invalid key and confirm the previous report survives.
4. Daily Review notes are excluded by default. Enable the notes checkbox only when you want to send them.
5. Install yfinance with npm run setup:market-data. Check Python, display recent 5m data and daily SPY data. Select older dates and verify available coarse intervals and coverage messages. No missing-data view should display invented bars.
6. Configure your own Massive key and plan. Verify invalid credentials and unavailable historical permissions produce visible explanations.
7. Configure a custom endpoint with the README example shape. Test mapping paths, seconds/milliseconds/ISO timestamps, timezone and supported intervals.
8. Confirm adjusted or coarse charts do not show exact execution-price overlays. Check a date around a US daylight-saving transition.
9. Remove test data from the local installation before distributing source. Keep .local and .env excluded from Git.

The initial project-wide lint baseline contained existing errors. Current checks and remaining unrelated warnings are documented in RELEASE_CHECKS.md.

## Static demo and import lesson

1. Run `npm run demo:build` and `npm run demo:preview`, then open `http://127.0.0.1:4173/#/dashboard`. The banner must identify fictional data and June 30, 2026. Stop the local Next server temporarily to confirm the demo remains usable.
2. Explore Dashboard date filters, Calendar day links, all five Reports tabs, Trades/detail pages and New Trade. Create, edit, tag and delete a fictional record; refresh to check browser persistence.
3. Open **How to Import Broker Trades** beside an import control. Download the blank CSV, completed CSV and tab-separated sample. Import the completed sample once: two executions, quantity 10 bought and 10 sold, total fees $1, gross P&L $20 and net P&L $19. Import it again: the existing trade must be skipped.
4. Try the tab-separated example in Smart Format Import. Clear the exercise trade before testing the same example through a different input method, or expect duplicate detection.
5. Test a short round trip, a missing-Pnl unmatched fill and an unmatched fill with broker-reported net Pnl. Check invalid dates, missing/incorrect columns and unsupported side codes. Errors must explain the correction and an invalid batch must save nothing.
6. Check filename date detection and the fallback selector. `06-30-2026.csv` uses June 30 even if the fallback differs. Verify execution times are displayed in New York time and quantities/fees/P&L agree with your fictional report.
7. Save a Journal note and trade evaluation. Generate simulated Daily Review, AI Coach and Edge Analysis responses. Change connections/models and market intervals. Credential fields must remain disabled; charts and AI output must remain labeled synthetic/simulated.
8. Test mobile navigation at about 390px wide, hash-route refresh, guide downloads and the video player. The tour must have controls, readable English captions and no autoplay. Open the SVG feature map and inspect its flow.
9. Use **Clear Data** to check empty states, then **Reset Demo** to restore 180 fictional trades. These controls affect this demo's browser storage; the local database remains separate.
10. In the local app, repeat the downloaded-example imports using a disposable copy or database. Reconcile and delete the exercise records afterward. Follow [DEMO.md](DEMO.md) to publish only after acceptance testing.
