# ON-01: Event-driven bar-close inference (design, then DEV)

**System:** S1 · **Week:** W49 (design in W48 if there is time) · **Depends on:** PC-01

## Goal
S1 decides at **the close of each bar** (H1 and H4), not whenever an hourly scheduled task
happens to run. Fresh price data comes from a stream, and the reaction delay is measured.

## Why
This is the first of three meanings of "online" in the review: event-driven inference. A
scheduled task can run minutes after a bar closes, or before the bar's data has landed.
For H1 and H4 strategies that delay costs entry quality. Online *learning* stays out of
scope on purpose: the weekly retrain stays.

## Steps
1. **Measure today's delay.** For the last 4 weeks of DEV and practice signals, compute
   (signal emitted − bar close) and (bar data landed − bar close). If the p95 delay is
   under 2 minutes, write that down and shrink this task to a watcher.
2. **Design note** at `docs/design/ADR-007-bar-close-inference.md` (dev brain), covering:
   - **Bar-close trigger source.** Options are the OANDA pricing stream (the chart
     upgrade says a price stream exists but isn't fed yet), a poll of the candles
     endpoint at close + 5 s, or `src/signals/watcher.py` if it already does this. Read
     it first.
   - **Completeness rule.** A bar counts only when the candle is `complete=true`.
   - **Idempotency.** Reuse the LR-07 key, so a duplicate trigger is harmless.
   - **Failure mode.** If the stream drops, fall back to the scheduled run, and a bell
     notice says so.
3. **Implement in DEV** behind `S1_BAR_CLOSE_TRIGGER=true`, keeping the scheduled job as
   a fallback that no-ops when the trigger already handled the bar.
4. **One week of DEV parity.** The same signals, with a smaller delay. Report it in
   `results/research/bar_close/<date>.md`.

## Acceptance
- The delay is measured, the ADR-007 note exists, and the DEV flag runs one week with a
  parity report.

## Guardrails
Gather no data before the bar is complete. The scheduled path stays until the owner
retires it.
