# PC-00: ADR-005 probability check, design and owner review

**System:** S1 (brain) · **Week:** W45 · **Owner action:** review and answer D5–D7 · **Depends on:** nothing

## Goal
A written, accepted design for the probability check. Every other PC task builds against it.

## Background
Read `plans/README.md` first. The draft ADR is
`C:\SB\dev\systems\brain\docs\design\ADR-005-probability-check.md`, written 2026-10-31
on branch `dev`. It defines:

- **The question.** For a candidate signal at decision time *t*, with direction, entry,
  SL, TP and hold window *H*:
  - `p_tp50` = P(price touches entry + 0.5·(TP − entry) before SL, within H)
  - `p_tp100` = P(TP is touched before SL, within H)
  - `p_sl` = P(SL is touched first, within H)
  - `p_time` = 1 − p_tp100 − p_sl, the probability of a timed exit
  - `exp_r` = expected R, built from the barrier probabilities and the conditional mean
    R in each outcome, net of cost.
- **The sources.** Each one produces a score that is logged on its own:
  - base rate: strategy × regime × geometry
  - market-state model (gatekeeper v3)
  - volatility reach probability
  - text tone alignment
  - event risk
  - cross-asset confirmation
- **The combiner.** A logistic stack over source logits, with weights fitted out of
  sample on purged walk-forward folds and an L2 penalty. Each weight is reported with a
  bootstrap CI. A source whose CI covers 0 is dropped.
- **The phases:**
  - shadow logging (PC-01)
  - labels and models (PC-02 to PC-04)
  - combiner in shadow (PC-05)
  - monitoring (PC-06)
  - promotion (PC-07)
- **The promotion rule.** At least 4 weeks of shadow and at least 60 resolved signals.
  The live Brier score must beat the base-rate-only score, with a CI. Expected-R deciles
  must be monotone. Until then, nothing alters a trade.

## Steps
1. Read the ADR. Check it against the current code:
   - `src/gatekeeper/train.py` and `score.py`
   - `src/signals/run.py` (the gatekeeper-routed path)
   - `src/research/live_emit.py` (the research-book path)
2. Confirm that both emit paths can call one evidence hook. If one cannot, record it in
   the ADR's open questions.
3. Owner: answer D5, D6 and D7 on the W45 page. Copy the answers, with the date, into the
   ADR's "Decisions" section.
4. Change the ADR status from PROPOSED to ACCEPTED in a commit on `dev`.

## Acceptance
- The ADR is ACCEPTED, with D5–D7 answered.
- The contract for the evidence row is frozen, i.e. the column list PC-01 implements.

## Guardrails
No source may veto a trade unless D5 allows it. The default is size modulation only, and
only after PC-07.
