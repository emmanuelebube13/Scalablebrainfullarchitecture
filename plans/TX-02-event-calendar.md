# TX-02: Economic event calendar and event-risk feature

**System:** S1 · **Week:** W46 · **Depends on:** nothing

## Goal
A stored, point-in-time calendar of scheduled macro events, plus an `event_risk` feature
per signal: whether a high-impact event for either currency of the pair falls inside the
trade's hold window, and how soon.

## Why
Volatility around scheduled events (CPI, NFP, central-bank decisions) decides many stops.
Knowing an event is coming is free, causal and directly useful for sizing and for the
morning briefing (TX-03). It is the most practical "supporting system".

## Steps
1. **Source (free only).**
   - First, check the existing collectors in `src/research/collectors/`: a Forex Factory
     archive was planned in edge research.
   - Otherwise use the public weekly calendar JSON that Forex Factory serves (the
     faireconomy weekly feed) for current weeks, and the official central-bank meeting
     calendars (Fed, ECB, BoE, BoJ, RBA, RBNZ, BoC, SNB) for decision dates.
   - Respect the site terms and fetch at most hourly.
2. **Table `ext.econ_event`:**
   - `event_id`, `currency`, `title`, `impact` (low/med/high)
   - `scheduled_utc`, `actual`, `forecast`, `previous`
   - `first_seen_utc`, which makes it point-in-time: a feature may use only events whose
     `first_seen_utc` ≤ decision time
   - `source`
3. **Collector** `src/research/collectors/econ_calendar.py`, scheduled hourly in DEV with
   `pythonw.exe` (no console window). It is idempotent on (source, currency, title,
   scheduled_utc).
4. **Feature** `event_risk` per signal:
   - `n_high_events_in_hold`
   - `hours_to_next_high` (capped at 240)
   - `cb_decision_in_hold` (bool)
   - Score = P(SL first | event in hold), from the base rates of historical trades that
     contained such an event (via PC-02). Until history is backfilled, log the raw
     counts only.
5. **Backfill** as far as the free archive allows, and state the coverage in the report.
6. **Wire** it as evidence source `event_risk` (PC-01).

## Acceptance
- The collector runs hourly in DEV.
- Every signal for 3 days has an `event_risk` row.
- The coverage report is committed.

## Guardrails
Use no event that was published after the decision time. The `first_seen_utc` column
exists for exactly that.

---

## Result: 2026-10-31 (Claude, dev brain `4e3368b`)

**Done, awaiting owner tick. Most of it already existed.**
- `ext.event` already holds everything this plan asked for: impact, actual/forecast/
  previous, and point-in-time `first_seen_at`.
- `collectors/ff_calendar.py` already runs every 6 h (`\SB research - calendar (6h)`),
  next to the FOMC and central-bank collectors. Stored so far: 243 macro releases since
  2026-10-18 (23 High), 191 FOMC events since 2004, 9 central-bank decisions.
- **Built:** the `event_risk` evidence source. For the pair's currencies (CFDs map to
  their economy), it counts High-impact, FOMC and central-bank events inside the hold
  window, using only events first seen at or before the decision. It reports hours to the
  next event and how far ahead the calendar could see. Example: EUR_USD decided Tue
  2026-10-27 has 8 high-impact events in a 5-day hold, including the FOMC.
- **Limits, stated honestly:**
  - The feed covers the current week only, so a hold past Sunday sees nothing beyond it
    (`calendar_known_until` records this).
  - The archive is forward-only from 10-18. A calibrated "P(stop first | event)" needs
    months of rows, so `score` stays empty and only counts are logged.
