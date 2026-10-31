# ON-02: Regime as router vs regime as feature, a walk-forward study

**System:** S1 · **Week:** W48 · **Depends on:** PC-02 (labels)

## Goal
Decide, with evidence, whether the D1 structural regime should keep **routing** signals
(the designations map picks strategies per regime) or become **one input** to the
probability check.

## Why
- The R3 regime-aware trial concluded negative: no significant uplift. See the
  `src/regime/structural.py` docstring (corrected 2026-09-05).
- The live map still routes by regime, and owner designations are kept by
  `keep_designations.py` after each retrain.
- A router discards signals that a feature would only weight. With few trades a week,
  discarding is expensive.

## Steps
1. On the PC-02 frame, compare three policies out of sample (purged walk-forward):
   - (A) today's routing: a signal is allowed only if its strategy is designated for the
     current regime
   - (B) no routing: all signals, with the regime as a feature in the PC-04 model
   - (C) no regime at all
2. Metrics:
   - trades per week (the owner wants at least a couple)
   - expected R per trade
   - total R per week
   - max drawdown in R
   - each with block-bootstrap CIs and the number of policies tested (3)
3. Correlated legs: a basket signal counts once.
4. **Report** at `results/research/regime_router/<date>.md`. **Recommendation only.**
   The owner's designations stay until the owner decides (see the "designations stay
   put" decision).

## Acceptance
- The report includes the three-policy table, CIs and the recommendation.
- No live change.
