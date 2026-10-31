# TX-03: Morning briefing bell (advisory only)

**System:** S1 + bell · **Week:** W47 · **Depends on:** TX-02 (calendar), ideally TX-01 (tone)

## Goal
At 07:00 America/New_York on trading days, the dashboard bell and phone push post a
short briefing. It is **advice only**: it never blocks or changes a trade. This is the
owner's "early-morning trade confirmation", in its safe form.

## Content (in this order, kept to what fits on a phone screen)
1. **Today's high-impact events** by currency, with local time in the owner's display
   time zone (live-book setting).
2. **Open trades exposed:** any open trade whose pair has a high-impact event before its
   `exit_by`, with the event and the time.
3. **Pending and expected signals:** what the research book or gatekeeper may emit today,
   and whether an event sits inside their hold.
4. **Latest central-bank tone** per currency (TX-01 winner): one line each, with its date.
5. **Probability-check note,** once PC-05 exists: any open trade whose `combined` exp_r
   has fallen below 0 since entry, worded as advice.

## Steps
1. Create `src/briefing/morning.py`. It reads `ext.econ_event`, the open book (S3 journal
   or the live-book read model), the latest `ext.doc_score` and the evidence rows. It
   builds the text deterministically.
2. **Optional LLM polish.** The text above is the source of truth. Claude may rewrite it
   into plain prose only if the owner turned that on in D6. Log the prompt, the output
   and the cost. Facts in the LLM's output must match the deterministic text; if they
   don't, send the deterministic text.
3. **Post** through `bell_relay.py` as a notice (severity info, or warn if an open trade
   is exposed) and to the private push channel when it exists (W46).
4. **Log** every briefing in `research.briefing_log` (append-only), so the advice can be
   audited later against outcomes.
5. **Schedule** at 07:00 America/New_York, Monday to Friday, via a pythonw scheduled task
   in DEV, then in prod after one week.

## Acceptance
- Five consecutive trading days of briefings in DEV, matching the calendar.
- The owner confirms the format.

## Guardrails
Nothing here can change an order. The words "skip" and "close" appear only as
suggestions, with the reason.
