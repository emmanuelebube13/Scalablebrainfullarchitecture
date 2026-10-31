# PC-06: Live calibration and drift monitor, with a dashboard panel

**System:** S1 + dashboard · **Week:** W48 · **Depends on:** PC-01

## Goal
"Online" in the safe sense: watch, live, whether each source's probabilities still match
outcomes and whether its inputs have drifted. Alert when they stop matching. Never
retrain automatically.

## Steps
1. **Resolution job (daily).** For each evidence row whose signal became a trade or a
   paper trade:
   - Attach the barrier outcome from the forward ledger or the shadow path.
   - Store it in `research.signal_evidence_outcome`, keyed by `evidence_id` and
     append-only.
   - Unresolved rows stay null.
2. **Metrics per source**, rolling 30 and 90 days, with n shown:
   - Brier score and skill against `base_rate`
   - reliability bins
   - mean predicted vs observed rate, with a Wilson CI
3. **Drift.**
   - Population stability index (PSI) on each model input, comparing the last 30 days
     with the training frame.
   - PSI > 0.25 posts an amber bell notice. A calibration gap whose CI excludes 0 for
     2 weeks posts a red one.
   - Use the existing bell relay.
4. **Dashboard.**
   - Add a "Probability check" card to the Performance view: one row per source, with
     Brier skill and its CI, a calibration sparkline, PSI and n.
   - Follow `DESIGN-SYSTEM.md`, including the fix-it rule: every red state names its
     action ("retrain review", "drop source").
   - With n < 30, show "not enough data", never a number.
5. **Publish** the JSON at `telemetry/probability_check.json`, written atomically with
   `platform/atomic`.

## Acceptance
- The panel renders in DEV with real or "not enough data" states.
- The alerts were tested by injecting a shifted input.
- Tests pass.

## Guardrails
Monitoring never changes a model or a trade. Show a live recall figure nowhere: rejected
signals never become trades, so live recall is meaningless (see `metric_semantics` in the
model card).
