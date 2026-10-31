# PC-08: Probability-driven trade management (partial TP, break-even lock)

**System:** S1 (research) → S2/S3 later · **Week:** W48 · **Depends on:** PC-02 (barrier paths), PC-05 (combined probability)

## Goal
Use the probability check to decide how an open trade is **managed** as well as how big
it is. Example: at a high P(TP), take a partial profit at TP50 and move the stop to
break-even, so we bank most of the money whether or not the full target is hit. Each
policy is chosen per probability band, on backtest evidence.

## Owner decision (W45-D5, 2026-10-31)
The probability check may change size **and** block trades. The owner also asked for
trade management of this kind: "at some point when it hits a take profit, it would lock in
a stop loss coming to break even, or it will hit a partial take profit… so that we earn
most of the money."

**Conflict to resolve in the report:**
- ADR-003 D5 set break-even and trailing stops **off** for the research book.
- Trade-health rules allow lock-BE only by the owner's button.

This task produces the evidence. Switching any policy on is a new owner decision that
supersedes ADR-003 D5 for the bands where it wins.

## Policies to compare
Compare these per probability band (< 0.30, 0.30–0.60, 0.60–0.85, ≥ 0.85, on calibrated
`p_tp100`):

| id | policy |
|---|---|
| P0 | hold to TP / SL / time exit (today) |
| P1 | at TP50 touch, move SL to entry (break-even), plus spread |
| P2 | at TP50 touch, close 50% and move the rest to break-even |
| P3 | at TP50 touch, close 50%; the rest runs with the original SL |
| P4 | at TP50 touch, close 100% (take the half target) |

## Steps
1. Reuse the PC-02 path walker. For every trade, rebuild the bar path and apply each
   policy with the same cost model, charging partial closes their own spread. OANDA
   allows partial closes by units; check the minimum units at small account sizes
   (LR-04 tiny-account table).
2. Assign each historical trade to a band by its **out-of-sample** combined probability
   from PC-05. Until PC-05 exists, use the `base_rate` + `vol_reach` probability.
3. Per band and policy, report:
   - expected R per trade
   - median R
   - share of trades ending ≥ 0R
   - max drawdown in R
   - R per week
   - each with block-bootstrap CIs. The number of comparisons is 5 policies × 4 bands,
     so report FDR-adjusted p-values.
4. Choice rule, written before the run: in each band, pick the policy with the highest
   expected R whose CI lower bound is ≥ P0's expected R. Otherwise keep P0. Tie-break by
   the lower drawdown.
5. Report at `results/research/trade_mgmt/<date>.md`, with the recommended policy per
   band and the ADR-003 D5 supersession wording for the owner to approve.
6. **Only after owner approval** (a separate follow-up task):
   - a contract field `management_policy` on the signal
   - S2 executes partial close and BE moves through its existing close and modify paths.
     Stops move toward profit only (invariant 8), and no new order types are added.
   - shadow first in DEV.

## Acceptance
- The report exists with the table, the choice rule applied, and a supersession draft.
- Nothing changes in S2 in this task.

## Guardrails
- A BE move never widens risk.
- A partial close never leaves a remainder below the broker minimum.
- The research book stays on P0 until the owner approves.
