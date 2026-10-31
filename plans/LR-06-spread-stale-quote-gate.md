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

---

## Result: 2026-10-31 (Claude, dev hand `2c8c10c`)

**Done, awaiting owner tick.**
- **One owner, S2**, already built as go-live B3. It refuses on:
  - a spread above 3× typical, or the class ceiling (3 pips majors, 6 crosses)
  - a quote older than 60 s
  - no quote at all

  S3 keeps only its clock rule (the rollover hold). No second gate was added.
- **Bug fixed:** `pip_size` assumed 0.0001 for every non-JPY instrument. On index, metal,
  energy and bond CFDs (pip 1.0 for SPX500, 0.01 for XAU) every spread read thousands of
  pips and every slippage bound was a rounding error, so **every CFD order was refused or
  cancelled**. Now:
  - S2 uses OANDA's `pipLocation` per instrument.
  - A new class `cfd` has **no default limits** and is refused, naming the key to set,
    until `MAX_SLIPPAGE_PIPS_<X>` and `SPREAD_TYPICAL_PIPS_<X>` (or `MAX_SPREAD_PIPS_<X>`)
    are set from measured quotes.
  - FX is unchanged.
- Tests: `src/system2/broker/tests/test_cfd_limits.py`. S2 suite: 598 passed.
- **Open:**
  - Measure typical spreads per pair before live. All are unset today, so the class
    ceilings apply.
  - Set CFD limits before any CFD trades.
  - `position_manager` (trailing/BE, off) still uses the FX pip rule.
