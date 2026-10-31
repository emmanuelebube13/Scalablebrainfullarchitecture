# LR-06: Spread-widening and stale-quote admission gate

**System:** S3 (and S2's existing guard) · **Week:** W47 · **Depends on:** nothing · **Register:** DECEMBER-READINESS §3

## Goal
No order is admitted on a widened spread or a stale quote. The check is made once, in a
known place, with thresholds that make sense for FX **and** index, bond and commodity CFDs.

## What already exists (checked 2026-10-31)
S2's `oanda_adapter.py` has a spread guard read from `execution_limits.py` (Go-live
B1/B3). S3's `gate/layers.py` has no spread layer that a grep can find. The S1 DQ fix
`dac68f1` showed that an FX-sized spread ceiling wrongly quarantined JP225.

## Steps
1. Document S2's spread guard: its thresholds, its units and when it runs. Decide, and
   write down, whether S3 needs a second gate or whether S2's guard is enough with better
   thresholds. Prefer **one** gate. A duplicate gate with different numbers is worse than
   none.
2. Whichever layer owns it gets two rules:
   - Reject when `spread > k × rolling median spread` for that instrument and
     hour-of-week (k = 2.5), or above an absolute per-instrument ceiling. Use the median
     from the stored spread history; check S1 DQ tables for spread data.
   - Reject when the quote timestamp is more than 60 s old.
3. Thresholds per instrument class, in price units or as a fraction of ATR, never in pips
   for CFDs.
4. Every rejection logs its reason code so it appears in the Risk Gate view.
5. Tests: wide spread, stale quote and a normal case, for EUR_USD and JP225_USD.

## Acceptance
- One documented owner of the gate.
- Tests pass for FX and an index.
- The register is updated.
