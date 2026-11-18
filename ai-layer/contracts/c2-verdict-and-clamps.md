# Contract C2: verdict checks and Guardian clamps (DRAFT 2026-11-16, not frozen)

Goes with `c2-verdict.schema.json`. This is the safety boundary of S4. Part A applies from the
first day (rung 0). Part B describes rung 2 and is **not built** before the promotion gate
passes and the owner decides; it is written now so that nothing built earlier contradicts it.

## A. Checks after the schema (code, in S4, every verdict)

A verdict that fails any check is stored with its status and treated everywhere as
**unassessed**. It is never repaired, re-asked with a hint, or replaced by a default.

| # | Check | Status on failure |
|---|---|---|
| A1 | parses and validates against the schema | `invalid_schema` |
| A2 | `action` belongs to the role (reviewer: proceed/shrink/skip; monitor: hold/lock_be/close) | `invalid_schema` |
| A3 | `size_multiplier` agrees with `action` (proceed 1; shrink 0.25/0.5/0.75; skip 0; monitor 1) | `invalid_schema` |
| A4 | every `evidence_ids` entry is an id present in the pack that was sent | `invalid_evidence` |
| A5 | a non-proceed, non-hold action has at least one evidence id and a reason other than `NO_CONCERN` | `invalid_evidence` |
| A6 | `INSUFFICIENT_CONTEXT` only with `proceed` or `hold` (not knowing is never a reason to act) | `invalid_schema` |
| A7 | realtime decisions: answered within the role's deadline (reviewer: 60 s from `as_of`, owner decision A3; monitor: 300 s). Batch decisions (observe rung, not on a live book, and all challengers unless the lead says otherwise): answered within 24 h | `timeout` |
| A8 | provider refused or errored | `refused` / `error` |
| A9 | monthly budget cap reached before the call (owner decision A2: $150) | `budget_blocked`, no call made |

A batch decision can never be shown or applied: it arrives too late by design. Any role at
rung 1 or above, and every signal on a live book, is answered in real time by the champion.

One model call per trial per decision. No retry on A1 to A6: a retry is a second opinion chosen after
seeing the first. One transport retry is allowed on a network error if the deadline still holds.

## B. Clamps at rung 2 (Guardian side, P3, not built yet)

**B0. Wire shape: open design question for P3.** A verdict is a veto or a size cap, not a
probability, so folding it into `probability.factors` would distort the combiner's calibration.
Recommended: a new optional `ai_review` object on ScoredSignal in a later wire version
(`decision_id`, `pack_hash`, `role`, `action`, `size_multiplier`, `answered_at`, `seat`,
`prompt_version`), applied by a new pure Guardian layer after Layer X and before sizing. Absent =
unassessed. This needs the three schema copies changed together and a deploy in the order S3
first. Until P3 the wire is untouched: rungs 0 and 1 live entirely in the ledger and dashboard.

The Guardian applies a verdict only if **all** hold; otherwise it ignores it and records why:

| # | Clamp |
|---|---|
| B1 | the instance's setting `ai.<role>.rung` is 2 or more in the current settings snapshot (default absent = 0) |
| B2 | `size_multiplier` is in [0, 1]; it multiplies after every other multiplier and can never raise size or risk |
| B3 | the verdict names this signal (`signal_id`) and `answered_at` is not older than 120 s at the Guardian |
| B4 | the skip floor: S4 has not already skipped or shrunk more than `ai.max_skip_share` (draft 0.5) of this strategy's signals in the rolling 7 days, and the instance has had fewer than `ai.max_skips_per_week` vetoes. Past the floor, verdicts are recorded and ignored (owner rule: the system must not be starved of trades) |
| B5 | the role is not demoted (scorekeeper flag in the snapshot) |
| B6 | every applied or ignored verdict is in `input_snapshot` of the decision log, as Layer X is today |

Position monitor at rung 2 acts only through `ams.ctl` (contract W0-1), with a new
`--via s4` value and operator `s4:position_monitor`:

| Verdict | Command | Extra limits |
|---|---|---|
| `lock_be` | `lock_be <broker_trade_id>` | the command's own refusals apply (stop moves toward profit only) |
| `close` | `flatten_trade <broker_trade_id> s4_<first reason code>` | at most one close per trade; at most 3 S4 closes per instance per day; never within 10 minutes of the trade opening |
| `hold` | none | — |

S4 may never call `close_strategy`, `set_strategy_control`, `promote_strategy`,
`withdraw_strategy`, `flatten_all`, pause, resume or reset. The runner refuses them for any
operator starting `s4:`. Rung 2 for the monitor needs a new owner decision replacing the
2026-10-30 "advice only" decision (blueprint A7).

## C. Rung 3 (expand)

No contract yet. Nothing in this file allows a multiplier above 1.
