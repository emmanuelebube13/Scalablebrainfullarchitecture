# PC-04: Gatekeeper v3 bake-off (LR vs XGBoost vs LightGBM), new label, calibration

**System:** S1 · **Week:** W47 · **Depends on:** PC-02 (labels), PC-03 (volatility feature)

## Goal
Pick the market-state model for the probability check on honest grounds. It predicts the
**barrier outcome** (TP100 first vs not, plus TP50 first), not `is_winner`, and its
probabilities are **calibrated** well enough to size a trade.

## Why
The current champion, `gk-6b9ed6c6`, was trained 2026-09-17 with feature set 2.0.0. It
fails on three counts:
- Approved expectancy is −0.060R against −0.087R for all trades: a filter on a losing
  pool.
- Its importance is dominated by geometry (R:R 36%, TP distance 26%, SL distance 19%).
- It is overconfident: a predicted 0.46 is an observed 0.33.

The model card is at `C:\SB\prod\state\model-cache\sets\<latest>\model_card.json`. The
model library is not the main lever, so the simplest model that ties wins.

## Where things are
- Training: `src/gatekeeper/train.py`. Feature derivation (`_derive_features`) is shared
  with serving, and the back-compat notes inside it apply.
- Serving: `src/gatekeeper/score.py`. Per-regime thresholds: `thresholds.py`.
- Bundle and promotion: `src/gatekeeper/promote.py` and `live_champion.py`. **Do not
  promote anything in this task.** Use `--dry-run`, which writes `proposed_champion_*`.

## Steps
1. **Frame.** Join `fact_trade_outcomes` to `fact_trade_barriers` (PC-02), the causal
   regime and `vol_reach_*` (PC-03). Targets:
   - `y100 = first_barrier == TP100`
   - `y50 = first_barrier in (TP50, TP100)`
2. **Features.**
   - Keep geometry: `atr_sl_multiplier`, `atr_tp_multiplier`, RR.
   - Add `vol_reach_tp100` and `vol_reach_tp50`, plus ADX, ATR percentile and causal
     regime probabilities.
   - Add the strategy family as a *grouped* category, not strategy_id. Strategy_id
     memorises, as WO-04B showed.
3. **Evaluation scheme.** Purged, embargoed, expanding-window walk-forward by entry time.
   - Embargo ≥ the max hold.
   - At least 5 folds.
   - Report the **final 12 months as a lockbox**, scored once at the end.
4. **Models**, each with the same features and the same optuna budget (≤ 50 trials per
   model, tuned only inside the training folds):
   - (a) L2 logistic regression with spline or binned geometry
   - (b) XGBoost
   - (c) LightGBM, with leaf limits for small noisy data
   - (d) CatBoost 1.2.10. Owner D7: test it, don't replace XGBoost blindly. Run with
     `PYTHONPATH=C:\SB\lab\pydeps\catboost-1.2.10`. Give strategy family and regime to
     it as native categoricals.
   - (e) **Ensemble:** the mean of the calibrated probabilities of (a)–(d), and a stacked
     LR over their logits fitted on the inner folds. The owner has used ensembles before
     and found XGBoost usually wins; the ensemble is tested on equal terms.
5. **Baseline to beat:** a base-rate-only model (strategy family × regime × RR bucket
   from PC-02). It is the "no market-state information" null.
6. **Metrics**, out-of-sample per fold and pooled:
   - log loss and Brier, with skill against the baseline
   - reliability diagram with ECE
   - expected R of the top tercile minus the bottom tercile (bootstrap CI)
   - monotonicity of realised R across score deciles
7. **Calibration.** Fit isotonic and Platt (sigmoid) calibrators on a held-out tail of
   each training fold. Pick the one with the lower OOS ECE.
8. **Choice rule, written into the report before the lockbox is opened:**
   - The winner is the simplest model within 1 SE of the best OOS log loss.
     XGBoost is the incumbent: another model or the ensemble replaces it only if it is
     better by more than 1 SE.
   - If none beats the base-rate model with a CI excluding zero, the market-state source
     is recorded as **adding nothing**. That is a valid result.
9. **Write the bundle** as a dry-run `proposed_champion_*` with the calibrator included.
   Serving needs `exit_by` or hold, geometry and the volatility feature at inference;
   list every missing live field (the 2.0.0 lesson in `train.py`).
10. **Report** at `results/research/gatekeeper_v3/<date>.md` with every number above,
    the trial count, and the decision.

## Acceptance
- The report exists with lockbox results and the choice rule applied as written.
- A proposed bundle exists, or a documented "adds nothing" outcome.
- No live bundle is changed.

## Guardrails
- No random K-fold.
- The test window is never used for tuning.
- If the lockbox is touched before the choice rule is written, say so in the report.
