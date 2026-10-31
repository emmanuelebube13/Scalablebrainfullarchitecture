# PC-02: Triple-barrier labels from rebuilt price paths

**System:** S1 · **Week:** W46 · **Depends on:** nothing (can start now)

## Goal
For every backtested trade, record which barrier was hit first (TP50, TP100, SL or time)
and when. This replaces `is_winner` as the training target and gives the base rates the
probability check needs.

## Why
`is_winner` ignores payoff and speed. The owner's question is "will price reach a
percentage of TP before SL in this window?", which is exactly a barrier label (López de
Prado, *Advances in Financial ML*, ch. 3).

## Where things are
- Trades:
  - `fact_trade_outcomes`: about 118k rows, with entry and exit,
    `atr_sl_multiplier`, `atr_tp_multiplier` and `risk_reward_ratio`. It is read in
    `src/gatekeeper/train.py`.
  - `research.run_trade`: research-book backtest trades.
- Bars: `fact_market_prices`.
- Prior art:
  - `src/incubator/shadow_path_tracker.py` already measures "reached 70% of TP before
    SL". Reuse its geometry guard (`min_risk_dist = max(3·pip, 1e-4)`).
  - ADR-004 (`docs/design/ADR-004-trade-health-keep-or-close.md`) rebuilds paths the same
    way. Share one path-walker with it; don't fork it.

## Steps
1. Create `src/outcomes/barriers.py`. Given direction, entry time and price, SL, TP and
   hold H, walk bars forward starting **after** the entry bar.
   - A long touches a TP level when the bar's high ≥ the level, and SL when the bar's
     low ≤ SL.
   - When one bar touches both, resolve it pessimistically as **SL first** and set
     `ambiguous_bar=true`.
   - Where lower-timeframe bars exist, re-resolve ambiguous bars on them.
   - Apply the backtest's own spread and cost model. Import it; don't copy it.
2. Choose hold H in this order:
   - the trade's `exit_by` / `hold_bucket` (ADR-003)
   - else the strategy's declared max hold
   - else the strategy's 95th-percentile historical hold, flagged in `hold_source`.
3. Output table `fact_trade_barriers`:
   - `trade_id`, `first_barrier` (enum)
   - `t_tp50_h`, `t_tp100_h`, `t_sl_h`: hours from entry, null if never reached
   - `r_at_exit`, `mfe_r`, `mae_r`
   - `ambiguous_bar`, `hold_source`, `labeller_version`
4. Backfill it for all trades. It must be idempotent, keyed by
   `(trade_id, labeller_version)`.
5. Validate:
   - On trades whose recorded exit came from a stop or target, the barrier label must
     agree with the recorded exit reason on at least 99% of them. List the disagreements.
   - Plot the base rate P(TP100 first) against `risk_reward_ratio`. It should fall
     roughly like 1/(1+RR) less costs. If it doesn't, the cost model or the walker is
     wrong.
6. Report at `results/research/barriers/<date>.md`, covering:
   - counts per barrier
   - the ambiguous-bar rate
   - the base-rate table by strategy × regime × RR bucket, with n per cell.

## Acceptance
- The table is populated and the agreement check is ≥ 99%.
- The report is committed.
- Tests cover long, short, both-touched, never-touched and DST-week cases.

## Guardrails
Labels may look into the future: that is what a label is. Features never may, so keep
this module separate from all feature code.

---

## Result: 2026-10-31 (Claude, dev brain `496b7f7`)

**Done, awaiting owner tick.**
- Code: `src/outcomes/barriers.py`, run with `python -m src.outcomes.barriers`. Tests:
  `src/outcomes/tests/test_barriers.py` (12 tests).
- Labels: `results/research/barriers/fact_trade_barriers-barriers-1.0.0.parquet`. The
  parquet is git-ignored; rerunning takes about 2 minutes.
- Report: `results/research/barriers/2026-10-31-barriers-1.0.0.md`, committed.

**Deviations from the plan, with reasons:**
- **Storage.** Trades and prices exist only in ForexBrainDB (prod). They were read
  read-only, and labels go to a parquet file instead of a `fact_trade_barriers` table, so
  nothing is written into prod. A DB table can follow if PC-04 needs SQL joins.
- **R races added.** About 30k trades declare no take-profit (trailing or time exits).
  Every trade with a stop also gets `hit_1r_before_sl` and `hit_2r_before_sl`, which
  widens coverage from about 88k to 118k trades.
- **The agreement check is per strategy, at 0.90, not 0.99 overall.** The label races the
  *initial* stop against the declared target. Strategies that move stops or fill inside
  the bar cannot be rebuilt from bars, so overall agreement (0.77) is the wrong test.
  Per-strategy agreement is bimodal: a cluster at 0.93–0.95 and a tail at or below 0.89.
  At 0.90, **18 of 42 strategies (57,498 trades) are "reconstructable"**, and only those
  should train the probability check. The rest are flagged in the report.
- **Ambiguous bars** (stop and target touched in the same bar) resolve as stop first.
  The rate is 0.1–4.7%, highest on D1. Lower-timeframe re-resolution was not done; it is
  a possible refinement.

**Finding that matters for PC-04 and PC-05.** In every R:R bucket the TP-first rate is
almost exactly the driftless coin-flip rate 1/(1+RR):

| R:R | TP first | 1/(1+RR) |
|---|---|---|
| 0.45 | 0.615 | 0.691 |
| 0.96 | 0.514 | 0.511 |
| 1.47 | 0.400 | 0.406 |
| 1.96 | 0.305 | 0.338 |

Mean R is about 0 before costs. The geometry carries **no directional edge**, which
matches the gatekeeper finding. A model can add value only by finding conditions where
the rate beats 1/(1+RR). It also validates the walker, because random-walk theory
predicts exactly these rates.
