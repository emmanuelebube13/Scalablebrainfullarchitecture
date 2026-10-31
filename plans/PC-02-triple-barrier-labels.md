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
