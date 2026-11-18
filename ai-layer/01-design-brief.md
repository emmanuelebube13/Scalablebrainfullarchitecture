# AI layer design brief: the three parts to design first

Written 2026-11-16 for the people (or a lead agent) who take the blueprint into design. The
reader was not in the conversation that produced it. Read `00-blueprint.md` first; the owner
accepted it and decisions A1 to A7 on 2026-11-16.

This brief covers **P0 only**: the foundations that touch no trade. It is a separate workstream
from the 11-15 build (`..\data-model\10-build-plan\`) and must not delay it.

---

## 0. The prompt to start a lead agent

```text
You are the lead for the Scalable Brain AI layer (S4), phase P0.
Read, in this order, before doing anything else:
  1. C:\SB\Scalablebrainfullarchitecture\ai-layer\01-design-brief.md   (your brief)
  2. C:\SB\Scalablebrainfullarchitecture\ai-layer\00-blueprint.md
  3. C:\SB\Scalablebrainfullarchitecture\ai-layer\contracts\  (c1, c2, c3: drafts to review and freeze)
  4. C:\SB\Scalablebrainfullarchitecture\data-model\10-build-plan\06-lead-agent-brief.md  sections 2, 3, 7
     (where code lives, the standing invariants, the agent prompt template: all apply here)
  5. C:\SB\Scalablebrainfullarchitecture\data-model\10-build-plan\STATUS.md  (do not start before Wave 2's gate has passed)
  6. C:\SB\dev\systems\brain\docs\design\ADR-008-signal-probability-gate.md and ADR-004
Start with the design review in section 4. Do not write code until the three contracts are
frozen. Everything in P0 runs against scalable_brain_dev and the DEV runtime only. Never deploy,
never write a production database, never register a scheduled task, never call a model API
before the owner has done step OS-AI-1: queue those as owner steps.
```

---

## 1. Mission, scope and stop rules

**Mission.** By the end of P0 the system can take a signal or an open trade, build a frozen
context pack, ask a model for a verdict, check it, store it, and later score it against what
happened, with a cost cap and a kill switch. No verdict reaches a trade, the dashboard or the
owner yet.

**In scope:** the `ai` schema (C3), the context pack builder (C1), the verdict checker (C2
part A), a thin model gateway, the scorekeeper, a replay tool, and the tests and fixtures named
in the contracts.

**Selected P1 feature additions:** a local Ollama seat for extraction and bulk text only; a
point-in-time state store for signals, trades, logs, strategy cards and tagged text; read-only
operator queries; open-trade diagnostic summaries; and isolated, validated backtesting. Reader
tags become lab features, not direct position sizing. Live judgment stays on an API trial until
the evidence gate passes.

**Out of scope for P0:** any change to Guardian, Hand, bridge, the wire contracts or
`ams.ctl`; the Reader (and its feature feed to the lab), Daily brief, Loss reviewer, Operator
and Researcher roles, which are P1; any dashboard screen; C2
part B (rung 2 clamps); pgvector; a local language model; a second provider.

**Stop and report to the owner when:**
- a contract cannot be frozen without changing something the 11-15 build owns;
- a design choice would put a model call inside the 250 ms probability-engine path;
- the pack cannot be built without data that identifies the account;
- the acceptance fixture "skip everything" passes the gate (the scoring is then wrong);
- anything needs a package that is not already in `venv-s1` (see 3.1).

---

## 2. Facts checked on 2026-11-16

| Fact | Detail |
|---|---|
| Machine | Ryzen 7 7700, 32 GB RAM, RTX 5070 12 GB (CUDA works in `venv-s1`), 1.6 TB free |
| `venv-s1` already has | `httpx`, `requests`, `jsonschema`, `pydantic`, `psycopg2`, `sqlalchemy`, `transformers`, `torch` |
| `venv-s1` does **not** have | `anthropic`, `openai`, `sentence_transformers`, `psycopg` (v3). App Control blocks `pip install` into the existing venvs and blocks new venvs |
| No model API key exists | no file for one under the secrets folder |
| The signal already has a slot for S1's own estimate | `probability` object on ScoredSignal v1.1 (`additionalProperties: false`, factors with name/version/p/weight) |
| Guardian Layer X | live in prod in **shadow**; acts as a cost filter (`exp_r = -cost_r`) |
| Operator commands | `ams.ctl` contract W0-1: `flatten_trade`, `lock_be`, `close_strategy`, `set_strategy_control`, `promote_strategy`, `withdraw_strategy`; `issued_via` limited to cli/panel/dashboard |
| Forward record | `research.forward_trade`, append-only, trigger-frozen; 43 incubator strategies recording since 2026-11-01 |
| Evidence tap | `research.signal_evidence` in `scalable_brain_dev`, fed hourly from prod decisions (read-only) |
| Standing owner decisions | trade-health actions are advice only (2026-10-30); stop moves toward profit only; real-money gates stay statistical; no paid data |

---

## 3. The three parts

### 3.1 Model gateway (keep thin; a prerequisite, not one of the three)

One module, one function: `ask(seat_key, prompt_id, pack) -> raw response + usage`. It reads
the seat from `ai.seat`, checks `ai.v_spend_month` against the cap **before** calling (C2 check
A9), sends the pack as data in a single request asking for JSON that matches the verdict schema,
enforces the deadline, and returns. It holds the only copy of the API key in memory, read from
a file under the secrets folder at start. A kill-switch file (`run\s4.disabled`) makes every
call return `budget_blocked` without contacting the provider.

Two delivery modes behind the same function: **realtime** (deadline enforced) and **batch**
(the provider's batch service at half list price, answers within 24 h) for observe-rung
decisions off the live book and for challengers. Both write the same `ai.decision` row.

Design questions to settle:
- **SDK or plain HTTP.** The provider's official Python SDK is the normal choice, but it is not
  installed and installing is blocked. Default for P0: a small client over `httpx` (already
  present) behind an interface, so the SDK can replace it the day the owner gets it allowed.
  Owner step OS-AI-2 offers that.
- **Seats for P0 (owner decision A5: one provider).** `reviewer-main` and `monitor-main` on
  Claude Opus 5.5 (`claude-opus-5-5`); nothing else is needed in P0. Record effort level in the
  seat. Pin the exact model id; a change is a new seat row and a new evidence set.
- **Structured output.** Use the provider's schema-constrained output so the answer is JSON by
  construction; C2 part A still checks it.
- **Refusals.** A refusal is a status, not an error to route around. No fallback model: a
  different model answering is a different seat.

### 3.2 Context pack builder (contract C1) — invest heavily

What the model sees decides everything else: honesty of the evidence, cost, and whether outside
text can steer it. The draft schema is `contracts\c1-context-pack.schema.json`.

Design work:
1. **Sources for each section**, by table and column, from `scalable_brain_dev`: setup from the
   signal (`research.signal_evidence` and, after Wave 2, `trading.signal`); strategy record
   from `research.forward_trade` and the strategy cards; market numbers from S1's bar store;
   events from `ext.event` (Forex Factory feed); exposure from the mirrored positions; data
   quality from the S1 DQ tables; position health from `trade_health.json` (ADR-004).
2. **The `known_at` rule.** For every source, name the column that says when the row became
   knowable (publish time, bar close plus ingest delay, not the event time). Where no such
   column exists, the section is absent until one is added. This is the look-ahead guard and it
   is the part most likely to be got wrong.
3. **What to leave out.** In P0 the `events` section carries the calendar only; Reader
   summaries arrive in P1. The `brief` section is absent (`not_built_yet`).
4. **Size.** Aim for 6,000 to 10,000 tokens. Measure with the provider's token counter, not by
   guessing.
5. **Privacy (owner decision A1).** A test that fails the build if the serialized pack contains
   an account id pattern, a path under the secrets folder, or a currency amount.
6. **Replay.** Given a `pack_id`, the tool rebuilds the pack from the same sources as of
   `as_of` and must reproduce the stored hash. A mismatch means a source is not point-in-time.

### 3.3 Verdict contract (contract C2) — invest heavily

Draft: `contracts\c2-verdict.schema.json` and `c2-verdict-and-clamps.md`. Part A is built in
P0. Part B is reviewed now and built at P3.

Design work:
1. **Reason-code vocabulary.** Ten codes are drafted. Review each against real cases from the
   last month of signals; a code nobody can point to an example for is removed.
2. **The multiplier grid** (0, 0.25, 0.5, 0.75, 1). Decide whether three shrink steps are worth
   having or whether proceed / halve / skip is enough to score cleanly.
3. **One call, no retry on a bad answer** (C2 part A). Confirm, or argue the alternative.
4. **The wire question B0** is recorded, not decided: it belongs to P3 and to the Guardian's
   owner.
5. **Prompt for each role.** Written to the pack, short, stored in `ai.prompt_version`. The
   prompt says plainly that not knowing means `proceed`/`hold` with `INSUFFICIENT_CONTEXT`.

### 3.4 Decision ledger and scorekeeper (contract C3) — invest heavily, build first

Draft: `contracts\c3-decision-ledger.md` (tables, measures, the gate, fixtures).

Design work:
1. **Review the DDL** with the db conventions of the build plan (surrogate keys, no default
   instance, triggers).
2. **Outcome join.** How a decision finds its trade: incubator and research signals to
   `research.forward_trade`; practice and live signals to `trading.trade` once Wave 3 lands
   (until then the Guardian journal mirror). Signals that never became a trade get no outcome
   and are counted separately.
3. **Counterfactual for the monitor** (`r_after_exit_advice`): exit at the next bar open after
   `answered_at`, with the strategy's cost model. Reuse `src/outcomes/fills.py`; do not rebuild
   entries at the bar open (known 0.41R error on pending entries).
4. **Baselines.** The random draw happens at decision time with a stored seed. The cost-filter
   baseline is Layer X's shadow multiplier from the same signal.
5. **Clustering key.** ISO week plus currency or index group is the draft. Check it against the
   index-reversal cluster (17 SHADOW cards that are mostly one bet).
6. **Registering the gate** before the first real decision is stored: one row per role in
   `ai.gate_registration`, numbers from C3 section 3 (owner decision A6).
7. **Trials, champion and challengers** (`ai.trial`, `ai.trial_event`). A decision cannot be
   stored without a trial registered before it. Check the tightening rule (`1 - 0.10 / k`)
   against the fixtures: it must stop a best-of-ten coin flip and still let a real effect
   through at k = 3. In P0 and P1 run at most one challenger, so the $150 cap holds.
8. **Owner follow-through** (`ai.owner_action`). The table is created in P0 so the schema is
   stable; it is filled from P2. Decide how "seen" is recorded (drawer opened, bell item
   opened, phone notification tapped).
9. **Confidence check** on the scorecard, for information only.

---

## 4. Order of work

| Step | Who | Output | Gate |
|---|---|---|---|
| D1 design review of C1, C2, C3 against the live schemas | one reviewer per contract, read-only | a list of changes per contract, each with the table, column or case that forces it | lead resolves; contracts marked FROZEN with a date and sha256 |
| D2 `ai` schema migrations, triggers, views | db agent | applied to `scalable_brain_dev` | C3 fixture rows for triggers and `v_unscored` |
| D3 pack builder + replay | s4 agent (new package `systems/brain/src/ai_layer/`, or its own top-level system: lead decides at D1) | packs for the last 200 mirrored signals, no model call | hash reproduces on replay for all 200; privacy test; `known_at` test |
| D4 verdict checker + gateway with a **fake provider** | s4 agent | end-to-end with canned answers | every C2 part A status produced by a fixture |
| D5 scorekeeper | s4 agent | scorecard from synthetic reviewers | every C3 section 4 fixture behaves as stated |
| D6 first real calls | after OS-AI-1 | 50 packs through the real seat in DEV, 25 realtime and 25 batch | 0 `invalid_schema`; cost per decision measured for both modes; month projection under the cap |

D2 to D5 need no API key and no spend. P1 (verdicts on the live incubator stream, rung 0)
starts only after D6 and a new owner go-ahead.

Agents follow the worktree rule of the build plan: own worktree under `C:\SB\lab\wt-ai-*`,
branch `ai/p0-<part>`, base brain `dev` (or umbrella `dev` for migrations). Standing
invariants: build-plan brief section 3, in full, plus:

13. No model call outside the gateway. No model output is ever executed, evaluated as code, or
    used as a file path, SQL or a command argument.
14. A model never sees text fetched from the internet except as Reader summaries inside a
    pack (none in P0).
15. Nothing in `ai.*` is read by S1, S2 or S3 in P0 to P2.

---

## 5. Owner steps known in advance

| Id | When | Step |
|---|---|---|
| OS-AI-1 | before D6 | create a model API key with a monthly spend limit of $150 set on the provider's side as well, and put it in a new file under the secrets folder |
| OS-AI-2 | optional, any time | allow the provider's Python SDK to be installed (App Control), so the gateway can drop its own HTTP client |
| OS-AI-3 | after the DEV gate | apply the `ai` migrations to `scalable_brain` |
| OS-AI-4 | before P1 | go-ahead to run the reviewer on the live incubator stream at rung 0, and register any scheduled task it needs |

---

## 6. Records

Keep `STATUS.md` and `OWNER-STEPS.md` in this folder, same form as the build plan's. Frozen
contracts stay in `contracts\` with a `SHA256SUMS` file. Changes to a frozen contract need the
lead to stop the affected work first.
