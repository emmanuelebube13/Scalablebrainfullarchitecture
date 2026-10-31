# PC-01: Evidence ledger, logging every source's score at signal time (shadow)

**System:** S1 · **Week:** W45 (schema + hook) → W46 (sources wired) · **Depends on:** the PC-00 contract

## Goal
Every candidate signal from **both** emit paths writes one append-only row per evidence
source, capturing what that source said at decision time. No source has a vote. This is
the dataset that will later prove or kill each source.

## Why
The owner wants supporting systems (LLM, FinBERT, local models) to raise or lower a trade's
probability. We can't know whether any of them helps without a forward record made at the
moment of decision. Backfilled text scores are contaminated (TX-04).

## Where things are
- Gatekeeper path: `C:\SB\dev\systems\brain\src\signals\run.py`, which scores with
  `src/gatekeeper/score.py`.
- Research-book path: `src/research/live_emit.py` (ADR-003).
- Forward ledger: `research.forward_trade`. **Read only, never write.** Its trigger-frozen
  pattern is in the `research.*` migrations; find them with
  `grep -rn "forward_trade" src/sql`.
- DB: dev is `scalable_brain_dev`, prod is `ForexBrainDB`, both via `src/common/db.py`
  (`get_engine()`).

## Design
Table `research.signal_evidence`, append-only. Use the same freeze trigger as
`forward_trade` to block UPDATE and DELETE.

| column | type | note |
|---|---|---|
| evidence_id | bigserial PK | |
| signal_key | text | the key idempotency uses: strategy, pair, timeframe, bar time, direction |
| emit_path | text | `gatekeeper` or `research` |
| decided_at_utc | timestamptz | decision time |
| source | text | `base_rate`, `gk_v2`, `gk_v3`, `vol_reach`, `tone_<model>`, `event_risk`, `xasset` |
| source_version | text | model or artifact hash |
| score | double | probability in [0,1] where meaningful |
| logit | double | logit(score), clipped at ±8 |
| payload | jsonb | raw inputs and outputs, enough to recompute the score |
| data_cutoff_utc | timestamptz | newest input timestamp used. CHECK ≤ decided_at_utc |
| cost_usd | numeric | metered LLM calls, else 0 |

Unique key: `(signal_key, source, source_version)`. Inserts use `ON CONFLICT DO NOTHING`.

## Steps
1. Write a migration for the table, unique key, CHECK, freeze trigger and an index on
   `decided_at_utc`. Number it after the latest migration in `src/sql`. Apply it to the
   dev DB only.
2. Create `src/evidence/hook.py` with `record(signal, sources)`. Each source exposes
   `name`, `version` and `score(signal) -> (score, payload, data_cutoff)`.
3. Run each source in its own try/except **after** the decision is made. A source failure
   is logged and never blocks emission. Follow the "observer has no vote" pattern in
   `src/regime/live.py::record_live_labels`.
4. Call the hook from both `signals/run.py` and `research/live_emit.py`.
5. Wire the first sources now:
   - `base_rate`: empirical TP-first rate for strategy × regime. Until PC-02 lands, use
     `fact_trade_outcomes.is_winner`.
   - `gk_v2`: the current champion's score.
6. Wire the rest when they exist: `vol_reach` (PC-03), `tone_*` (TX-01), `event_risk`
   (TX-02), `gk_v3` (PC-04).
7. Tests:
   - UPDATE and DELETE raise.
   - A duplicate insert is a no-op.
   - A failing source does not stop emission.
   - A future `data_cutoff_utc` is rejected.
8. Add a DEV daily check that counts rows per source. It posts a bell notice when a wired
   source logged zero rows on a day that had signals. Bell: `bell_relay.py`.

## Acceptance
- On DEV, every emitted signal for 3 consecutive days has `base_rate` and `gk_v2` rows.
- All tests pass.
- The migration is applied to dev only, and the prod migration is listed for the next
  owner deploy.

## Guardrails
Nothing in this task reads evidence back into a live decision. The hook may add at most
200 ms p95 to emission. LLM sources run asynchronously, or are skipped until TX-01.
