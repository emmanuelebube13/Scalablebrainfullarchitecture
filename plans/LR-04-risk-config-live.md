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

---

## Result: 2026-10-31 (Claude, dev guardian `0599444`). Code done; **numbers need owner approval**

- `AMS_RISK_PROFILE=live` loads `config/risk_config.live.json`. S3 refuses to start if
  that file is missing, or if it doesn't declare `"_profile": "live"`, so a renamed
  practice file can't pass. Default is practice, unchanged. 6 new tests pass.
- **10 tests failed before this change**, in `tests/test_gate_pipeline.py` and
  `tests/scenarios`. They also fail on HEAD without it: stale test assumptions against
  today's `risk_config.json`. I didn't touch them; they need their own task.

### Proposed live numbers (owner decides)

| Setting | Practice today | Proposed live | Why |
|---|---|---|---|
| Max risk per trade | 2.0% | **0.5%** | A losing streak of 10 costs ~5%, not ~20% |
| Research-book risk (ADR-003 D1) | 0.10% | **0.10%** | Unchanged, as decided |
| Min risk per trade | 0.1% | 0.1% | |
| Soft daily loss (halve size) | 2.0% | **1.0%** | |
| Hard daily loss (24 h halt) | 3.0% | **2.0%** | |
| Weekly loss (7-day halt) | 6.0% | **5.0%** | |
| Next week's risk after a weekly halt | 0.5% | **0.25%** | |
| Max drawdown | 20% | **15%** | |
| Consecutive losses halt | 10 | **6** | |
| Max open trades | 10 | **6** | |
| Max trades per day | 16 | **6** | Still more than "a couple a week" |
| Risk on one pair | 10% | **1.0%** | All exposure = risk-at-stop as % of equity |
| Risk on correlated pairs | 20% | **1.5%** | |
| Total open risk (heat) | 30% | **3.0%** | |

Everything else (time rules, Friday/rollover blocks, Kelly ¼) is copied unchanged.

### Tiny-account check

Smallest risk OANDA allows (1 unit, or its minimum for CFDs) at our median stop, against
each risk budget. Specs come from the practice account, read-only, 2026-10-31.

| instrument | median stop % | min risk CAD | $200 @0.1% | $200 @0.25% | $200 @0.5% | $5k @0.1% | $5k @0.25% | $5k @0.5% |
|---|---|---|---|---|---|---|---|---|
| 15 FX pairs (EUR_USD … GBP_NZD) | 0.50–0.86 | 0.006–0.013 | ok | ok | ok | ok | ok | ok |
| XCU_USD | 1.27 | 0.11 | ok | ok | ok | ok | ok | ok |
| USB02Y_USD | 0.08 | 0.12 | ok | ok | ok | ok | ok | ok |
| USB10Y_USD | 0.25 | 0.38 | NO | ok | ok | ok | ok | ok |
| SPX500_USD | 0.63 | 0.66 | NO | NO | ok | ok | ok | ok |
| WTICO_USD | 1.87 | 2.73 | NO | NO | NO | ok | ok | ok |
| XAU_USD | 0.69 | 3.74 | NO | NO | NO | ok | ok | ok |
| JP225_USD | 0.85 | 7.37 | NO | NO | NO | NO | ok | ok |
| EU50_EUR | 0.99 | 9.43 | NO | NO | NO | NO | ok | ok |
| UK100_GBP | 1.01 | 20.34 | NO | NO | NO | NO | NO | ok |

**What this means:**
- **Month 1 ($200):** only the FX pairs, copper and the 2-year bond can trade at the
  research size of 0.10% (CAD 0.20 of risk). Gold, oil and the indices would be rejected
  as too small.
- **Month 2 ($5k):** everything except the index CFDs works at 0.10%.

Margin is small. A 0.5%-risk position at $5k needs about CAD 100–860 of margin, at
OANDA's rates.
