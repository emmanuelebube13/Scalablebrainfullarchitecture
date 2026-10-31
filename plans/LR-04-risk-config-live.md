# LR-04: `risk_config.live.json` profile

**System:** S3 (guardian) · **Week:** W47 · **Depends on:** LR-03 (the mode selects the profile) · **Register:** DECEMBER-READINESS §3

## Goal
A separate, reviewed live risk profile that S3 loads only in live mode. It is sized for
the owner's funding path: about $200 in month 1 to test plumbing, about $5k in month 2.

## Inputs
- Current profile: `systems/guardian/config/risk_config.json`, plus its `.bak-*` history.
- Owner decisions:
  - ADR-003 D1: 0.10% fixed risk for research trades.
  - At least a couple of trades a week.
  - IIROC leverage caps for the CAD account: 33:1 majors, 20:1 minors. Check the CFD
    margin rates against OANDA instruments (LR register §2).

## Steps
1. Diff `risk_config.json` against the needs of live mode and list every key.
2. Draft `risk_config.live.json`:
   - per-trade risk: 0.10% for research and 0.25–0.5% max for others (owner picks)
   - `max_open_positions`
   - per-currency exposure caps
   - daily drawdown 2% of day-start equity and weekly 5%, which feed the LR-05 latch
   - Friday and rollover rules unchanged
3. **Tiny-account check:** at $200 equity, OANDA's minimum of 1 unit and its precision
   may make 0.10% risk impossible on some instruments. Compute the smallest achievable
   risk per instrument and list the instruments that can't be traded at that size.
4. Load the profile by mode in `ams/config.py`. Refuse to start if mode = live and the
   live profile is missing or invalid (schema-checked).
5. Tests, then owner review of the numbers. **The numbers are the owner's decision.**
   Present them as a table.

## Acceptance
- The profile file exists, loading is tested and the tiny-account table is produced.
- The owner has approved the numbers (record the decision).
