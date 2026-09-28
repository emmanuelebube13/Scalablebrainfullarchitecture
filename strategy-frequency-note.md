# Strategy Trade Frequency and Filtering Note

### Why Qualified Strategies Don't Trade Daily
The core `QUALIFIED` strategies in the Scalable Brain architecture (`reference_pullback_continuation`, `h4_forex_system`, `bb_midline_break`) operate with extremely high win rates (66%-73%) and massive Profit Factors (2.0+). The trade-off for this statistical edge is extreme selectivity.

Historically, they fire between 0.35 to 1.6 trades per month. 

### Why We Shouldn't Loosen Their Rules
It might be tempting to configure these strategies to trade 3 to 4 times a week, planning to guard the resulting trades with new external data sources (like alternative data, sentiment, cross-asset correlation) later on.

**This should not be done before the data architecture is in place.**
1. **Trading the Reject Pile:** Loosening the entry criteria means accepting the very setups that the original strict strategy successfully filtered out (the losers).
2. **Missing Guards:** Without the alternative data architecture built and historically backtested, those "loosened" trades have zero guards. It will result in trading noise and bleeding expectancy.

### Architectural Solution
The system is designed to achieve trade volume not by forcing one strategy to trade frequently, but by running **hundreds of uncorrelated, highly strict strategies**.
When the architecture for the new data sources is complete, we should build **brand new strategy variants** specifically designed to use that data as a filter, and run them through the historical walk-forward vetting pipeline.
