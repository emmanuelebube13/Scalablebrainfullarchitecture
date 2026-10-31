# LR-07: S1 signal-emit idempotency and dead-letter

**System:** S1 · **Week:** W47 · **Depends on:** nothing · **Register:** DECEMBER-READINESS §1

## Goal
A database blip or a rerun of the emitter can neither drop nor double-emit a qualifying
signal.

## Where things are
- Gatekeeper path: `systems/brain/src/signals/run.py`, `ledger.py`, `setup_dedup.py`,
  `state_guard.py`, `publish_ledger.py`.
- Research path: `src/research/live_emit.py`. It has a `--parity` mode, so check what
  dedupe it does.
- Queue: SQLite in DEV (`QUEUE_PROVIDER=sqlite`, `C:/SB/devenv/queue/queue.db`).

## Steps
1. Read `setup_dedup.py`. It probably already creates a unique key. Record which key is
   used, on which table, in which DB, and whether **both** emit paths go through it.
2. Make the key `(strategy_id, pair, timeframe, bar_timestamp, direction)` on the emitted
   signal log for both paths, with inserts as `ON CONFLICT DO NOTHING`. Add a migration
   if one is missing.
3. Dead-letter: when publishing to the queue fails, write the signal to
   `signals_dead_letter` with the error. Retry with backoff on the next run, and post an
   amber bell notice if anything is older than one bar.
4. Tests:
   - A double run emits once.
   - A DB exception during publish goes to the dead letter.
   - A retry succeeds and clears the entry.
5. Update the register.

## Acceptance
- Tests pass for both emit paths.
- The register is updated.
