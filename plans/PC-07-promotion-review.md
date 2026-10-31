# PC-07: Promotion review, expected R as a size modulator

**System:** S1 → S3 · **Week:** first read in W49, decision when the evidence qualifies · **Depends on:** PC-05, PC-06, ≥ 4 weeks of shadow

## Goal
An evidence-based owner decision on whether the combined probability check may change
real position sizes, and an implementation if the answer is yes.

## Promotion criteria (fixed now, before any data is seen)
Promotion requires all of these:
- ≥ 4 weeks of shadow and ≥ 60 resolved signals with a `combined` row.
- Brier skill against `base_rate` > 0, with a 90% CI excluding 0 (block bootstrap by
  week).
- Realised R across `exp_r` terciles is monotone, top tercile above the bottom one.
- No red drift alert in the last 2 weeks.

## Steps
1. Produce the review pack (`results/research/promotion/<date>.md`) with every criterion,
   its number and its CI. If a criterion fails, the recommendation is "stay in shadow",
   with the date of the next review.
2. If it passes and the owner approves in writing (record the decision in
   `design/DECISIONS.md` on the site and in ADR-005):
   - S3 reads `suggested_size_mult` from the signal payload, as an optional contract
     field with default 1.0.
   - It applies the multiplier to the sizing in `ams/risk/sizing.py` **after** every risk
     cap, so it can never exceed the caps.
   - Owner D5 bands on calibrated `p_tp100`:
     - < 0.30: **block** (size 0)
     - 0.30–0.60: 0.5x
     - 0.60–0.85: 1.0x, rising linearly to 1.25x
     - ≥ 0.85: up to 1.5x
   - Before freezing the bands, check them against each geometry's break-even
     probability, 1/(1+RR) plus costs. If the 30% floor would block a band of wide-target
     trades whose OOS expected R is positive, present that to the owner with numbers.
     Options: a per-RR floor, or a floor on `exp_r` instead.
   - The management policy per band comes from PC-08, if approved.
3. Deploy order: contract → S3 → S1 flag `PROB_CHECK_SIZING=true`, DEV first, with
   1 week of parity before practice.
4. Add a kill switch: the flag off restores size × 1.0 immediately.

## Acceptance
- Either a written "stay in shadow" review with the next date, or an approved, deployed
  and flag-guarded size modulator with parity evidence.

## Guardrails
This task must not run early because a week looked good. The criteria above are frozen.
