# PC-03: Volatility forecaster (HAR-RV) and reach-probability feature

**System:** S1 · **Week:** W46 · **Depends on:** nothing (the calibration check in step 5 uses PC-02)

## Goal
A per-asset volatility forecast over the trade's hold window, turned into a
reach-probability feature: how likely price is to travel the TP distance before the SL
distance within time *H*, given forecast volatility and no directional view.

## Why
The owner pointed out that volatility drives most of whether a trade gets there. Direction
is barely forecastable, but volatility is. HAR-RV (Corsi, 2009) is the standard simple
model, and it is linear, so numpy and sklearn are enough. `arch` and `statsmodels` are not
installed and must not be added.

## Steps
1. **Realized variance.** From H1 bars (M15 where available), compute daily RV as the sum
   of squared log returns within the FX day. Anchor the day at **17:00 America/New_York**,
   like the rest of the system.
2. **HAR regression per asset.** Model log RV over the next h days on three log-RV terms:
   the last day, the last 5 days' mean and the last 22 days' mean.
   - Fit expanding-window OLS with `sklearn.linear_model.LinearRegression`.
   - Horizons h = 1, 5 and 10 days.
   - Store the coefficients for every refit.
3. **Baselines.** Compare against ATR(14) scaled to the horizon and against EWMA
   (λ = 0.94), using out-of-sample QLIKE and MSE on log RV. Keep HAR only if it beats
   both on most assets. Otherwise ship the best baseline behind the same interface.
4. **Reach feature.** Treat price as driftless Brownian motion with σ equal to the
   forecast volatility over H. Compute P(the TP barrier is hit before the SL barrier,
   within H).
   - Barriers sit at +TP distance and −SL distance from entry, after spread.
   - Use a closed form or a vectorised 10k-path Monte Carlo.
   - Outputs: `vol_reach_tp100` and `vol_reach_tp50`.
   - Cache results by (asset, date, geometry bucket).
5. **Calibration check.** Against `fact_trade_barriers` (PC-02), compare
   `vol_reach_tp100` with the realised TP-first rate in deciles. A driftless model should
   be roughly calibrated on average. Large misses mean the volatility forecast or the
   cost model is wrong.
6. **Wiring.** Expose it as evidence source `vol_reach` for PC-01 and as a feature for
   PC-04.
7. **Report** at `results/research/vol/<date>.md`: the QLIKE table, calibration deciles
   and per-asset notes. Index, bond and commodity CFDs have different session hours, so
   check them separately.

## Acceptance
- The out-of-sample comparison table exists and the chosen model is justified.
- The source is wired in DEV.
- Tests cover FX-day anchoring across the DST change.

## Guardrails
Every input bar is ≤ decision time. Refits are expanding-window only. The rolling means
never include the bar being forecast.

---

## Result: 2026-10-31 (Claude, dev brain `20bf970`)

**Done, awaiting owner tick.**
- Code: `src/features/vol_forecast.py`, run with `python -m src.features.vol_forecast`.
  Tests: `src/features/tests/test_vol_forecast.py` (8 tests). They cover the DST roll,
  check the exact formula against a Monte Carlo, and test causality by changing the
  future and asserting the past forecasts don't move.
- Report: `results/research/vol/2026-10-31-vol-har-1.0.0.md`. Per-trade
  `vol_reach_*` values are in a git-ignored parquet next to it.

**Results:**
- **HAR beats EWMA and ATR on 69 of 72 asset × horizon cells (QLIKE).** The 3 losses are
  all EUR_CHF, where the January 2015 SNB unpeg day dominates the average for every
  model. HAR is the model shipped.
- **The reach probability is well calibrated.** Predicted vs observed TP-first agrees
  within about 2 points in every decile.
- **It adds little beyond geometry.** Brier skill over 1/(1+RR) is +0.6% on the
  reconstructable strategies and +2.6% on all strategies with a target. Volatility tells
  how far price will travel, not which way. This is expected, and it is the honest
  input for the PC-05 combiner, which will weight it accordingly.
- Timed exits are under-predicted (2.1% predicted vs 5.2% observed). Hold windows are
  approximate, which matches the PC-02 note on v2's conditional time exits.

**Deviations:**
- An exact closed form replaced the Monte Carlo.
- Duan smearing corrects log-HAR's low bias.
- Wiring as a PC-01 evidence source waits for PC-01 itself.
