# PC-05: Stacking combiner and expected-R output (shadow)

**System:** S1 · **Week:** W48 · **Depends on:** PC-01 (evidence ledger), PC-04 (market-state model), TX-01 (a tone source, optional)

## Goal
One calibrated set of barrier probabilities per signal, plus expected R, built from all
the evidence sources. The combiner learns how much each source **adds**. It runs in
shadow and logs as source `combined`.

## Why
Supporting systems disagree, and some are correlated (FinBERT and an LLM read the same
news). Multiplying or averaging their probabilities counts correlated sources twice and
makes the combined forecast overconfident. A stacked logistic model on source logits
(a fitted logarithmic opinion pool) learns the weights, and a source worth nothing gets
about zero weight.

## Steps
1. **Training frame.** Historical signals with the logits of every source that can be
   computed causally, joined to the PC-02 barrier outcome.
   - Text and LLM sources have no clean history before the model's cutoff (TX-04), so
     they enter the combiner only once the forward evidence ledger has data.
   - Until then, fit the combiner without them and refit as the ledger grows.
2. **Model.** L2 logistic regression with `y100` as the target and source logits as
   inputs, plus an intercept per strategy family.
   - Fit a second model for `y50` the same way.
   - Fit on purged walk-forward folds, as in PC-04.
3. **Weights.** Report each source's weight with a block-bootstrap 95% CI (blocks are
   weeks). Drop a source whose CI includes 0 and which doesn't improve OOS log loss.
4. **Expected R.**
   - `exp_r = p_tp100·R_tp + (p_tp50 − p_tp100)·E[R | TP50 but not TP100] + p_sl·(−1) + p_time·E[R | time exit] − cost`
   - Estimate the conditional means from PC-02 per strategy family.
   - Clip p_tp50 ≥ p_tp100.
5. **Serving.**
   - Create `src/evidence/combine.py`. It reads that signal's evidence rows and writes a
     `combined` evidence row whose payload holds the probabilities, `exp_r` and the
     per-source contributions.
   - Contributions are weight × logit, so the dashboard can show why.
6. **Size suggestion, logged only.**
   - `suggested_size_mult = clip(exp_r / median_exp_r, 0.5, 1.5)`
   - The bounds are fixed in the ADR and never applied here.
7. **Report** at `results/research/combiner/<date>.md`:
   - the weights table
   - OOS skill against the base rate
   - the share of signals that would be scaled up or down.

## Acceptance
- A `combined` row exists for every DEV signal for 5 days.
- The weights report is committed.
- Nothing reaches S3 or S2.

## Guardrails
Shadow only. Promotion is PC-07. Weights are refitted at most weekly with the retrain,
never per trade.
