# AI layer blueprint (S4): initial plan

Status: ACCEPTED by the owner 2026-11-16 (decisions A1 to A7, section 11). Nothing here is built. This is the map that the
design work starts from; section 9 says which parts deserve heavy design and which do not.

## 1. What the owner asked for

An AI-native layer on top of Scalable Brain that can read large amounts of data, research a
trade before it is taken, accept, shrink, expand or end trades, coordinate smaller agents, and
serve the end goal (grow capital toward the 2027 target). Local model or frontier API are both
acceptable if the spend supports growth.

## 2. The short version

1. **Build it as a fourth system (S4) that advises S1 to S3, not as a replacement for them.**
   The Guardian (S3) stays the final authority on every order. S4 can only speak through
   contracts the Guardian already clamps.
2. **Use frontier models over the API for judgment, and the local GPU for bulk text work.**
   This machine cannot run a model good enough to trust with money (section 6).
3. **Every AI role starts with no authority and earns it from a forward record.** A language
   model cannot be backtested honestly on history it has already read, so the only valid
   evidence is what it says today, scored against what happens next.
4. **Reducing risk can become automatic first. Increasing risk comes last and needs the owner.**
   This matches the allocation recommendation already on the table (decision D2, option c).
5. **If S4 is down, slow or wrong, trading carries on exactly as it does today.**

One honest limit up front: a language model does not predict prices. Our own factor studies
(regime, confluence, risk state, COT) all came back with no signal, and the probability gate is
a cost filter today. S4 will not create an edge the strategies lack. Where it can plausibly add
money is in section 3.

## 3. Where AI can actually help, ranked by how much evidence exists

| # | Job | Why it is plausible | Evidence today |
|---|---|---|---|
| 1 | Research throughput: more hypotheses tested honestly, faster | already how the lab works (cards, pre-registration, kill rules) | strong, in daily use |
| 2 | Reading text that moves markets (central banks, news, calendar) | FOMC tone strategy is PROMISING; LLMs beat FinBERT on headline accuracy (0.79 vs 0.56) | some |
| 3 | Operations: catching a broken feed, a stuck order, a silent outage | DEV was down 6 days unnoticed; 290 alerts never delivered | strong need, no AI evidence yet |
| 4 | Avoiding known-bad contexts before entry (event in 20 minutes, spread blown out, stale bars, doubled exposure) | mostly rule-shaped; AI adds the cases rules did not foresee | weak |
| 5 | Judging an open trade ("is the reason for this trade still true?") | ADR-004 shows the rule-based version helps only 1 strategy of those tested | weak |
| 6 | Sizing up a trade on AI conviction | no evidence anywhere in our records | none |

The plan spends design effort in that order. Item 6 is what "rapid capital optimisation" sounds
like, and it is the last thing to automate.

**AI as a source of strategies, not only a judge of them.** Item 2 has a second use that is
at least as valuable as reviewing trades. The FOMC tone strategy works by turning text into a
number and trading the number. Every tag the Reader writes (direction hint, importance,
surprise against expectation) is such a number. Those go to the lab as features, and a
strategy built on one goes through the normal card, pre-registration and kill rules, forward
only (text before the model's training cutoff never counts). This path needs no authority
ladder: a text strategy is a strategy, and the Guardian treats it like any other.

## 4. Architecture

```
            sources                       S4: AI layer                         existing systems
  ┌──────────────────────┐   ┌─────────────────────────────────────┐   ┌───────────────────────┐
  │ prices, bars (S1)    │   │  A. Context store                   │   │ S1 Brain              │
  │ event calendar       │──▶│     events, documents, embeddings   │   │  probability engine   │
  │ news / central banks │   │     (Postgres + pgvector)           │   │  (factor slot 1: LLM) │
  │ COT, rates, VIX      │   │                                     │   └──────────┬────────────┘
  │ our own DB: trades,  │   │  B. Context pack builder            │              │ signal + probability
  │ journal, ledger,     │   │     frozen, hashed snapshot per     │              ▼
  │ strategy cards       │   │     decision (what the model saw)   │   ┌───────────────────────┐
  └──────────────────────┘   │                                     │   │ S3 Guardian           │
                             │  C. Roles (section 5)               │──▶│  Layer X, sizing,     │
                             │     each = prompt + schema + tools  │   │  caps, breakers       │
                             │                                     │   │  FINAL AUTHORITY      │
                             │  D. Model gateway                   │   └──────────┬────────────┘
                             │     routing, budget cap, retries,   │              ▼
                             │     kill switch, vendor-neutral     │   ┌───────────────────────┐
                             │                                     │   │ S2 Hand → broker      │
                             │  E. Decision ledger (append-only)   │   └───────────────────────┘
                             │     verdict, inputs hash, model,    │
                             │     prompt version, cost, outcome   │──▶ dashboard (advice, bell)
                             │                                     │
                             │  F. Scorekeeper                     │──▶ promotion gate (section 7)
                             │     verdict vs what happened        │
                             └─────────────────────────────────────┘
```

Design rules that hold for every part:

- **S4 never holds broker keys and never writes to the queue or the Guardian database.** It
  acts only through two existing doors: the `probability` object on a signal (ADR-008), and
  audited `ams.ctl` commands (Wave 0 contract) from a reduce-only allow-list.
- **Verdicts are structured data, never free text.** A fixed schema (action, size multiplier in
  [0, 1], confidence, reason codes, evidence ids). Anything that fails the schema is dropped
  and counted as "unassessed".
- **The model sees a frozen context pack, not the live world.** The pack is built by code,
  hashed and stored. This makes every decision replayable and stops a web page from talking
  the model into something (prompt injection): roles that judge trades have no web access.
  Only the reader roles touch outside text, and they can only write rows to the context store.
- **"Vast data" is handled by pipelines, not by the model.** Code ingests and indexes; the
  model asks for what it needs through read-only query tools and gets a few thousand words
  back. Nobody pastes a database into a prompt.
- **Most roles are single structured calls, not free-roaming agents.** Open-ended agents are
  kept for research and operations, where a mistake is caught by a test or a person.
- **Settings come from the new `config` schema** (per instance, hashed snapshot), so demo,
  shadow and live can each give S4 a different authority level.

## 5. The roles

| Role | Trigger | Reads | Produces | Path to effect |
|---|---|---|---|---|
| **Reader** (many small workers) | new document, headline, calendar change | outside text | tagged event rows: instrument, direction hint, importance, source | context store; the same rows are features for the lab (section 3) |
| **Loss reviewer** | weekly, over closed losing trades | the trade's context pack and what happened after | reason codes and a two-line note per loss; a weekly tally | dashboard and the research backlog; no trade effect, no rung |
| **Daily brief** | 06:00 UTC and before major events | context store, positions, calendar | per-currency and per-index bias with reasons | `research.market_context` (ADR-008 factor 5) |
| **Trade reviewer** | every signal, before publish | context pack: setup, strategy card and record, events near the hold window, open exposure, data quality | proceed / shrink (multiplier) / skip | signal `probability` factor `llm_<model>` → Guardian Layer X |
| **Position monitor** | event hits an open trade, health change, price near stop, timed checks | context pack for that trade | hold / tighten / close advice | dashboard drawer + bell; later `ams.ctl` reduce-only |
| **Operator** | heartbeats, reconciliation, alerts, owner's message | telemetry, logs, ledgers | plain-language incident note, proposed owner step | bell + (later) phone; read-only |
| **Allocator's analyst** | nightly, after ALLOC-v1 | allocation output, forward ledger, goal progress | explanation and flags; never a multiplier | dashboard; ALLOC-v1 stays the rule |
| **Researcher** | owner or schedule | everything in the lab | hypothesis cards, backtests, reports | existing pre-registration loop |
| **Coordinator** | all of the above | the queue of work | routing, budget, deadlines, escalation to a stronger model | internal |

The coordinator is plain code with rules, not a model. A model is only asked to coordinate
inside the Researcher and Operator roles, where sub-tasks are open-ended.

Timing: the probability engine has a 250 ms budget, and a model answer takes seconds. So the
Trade reviewer either (a) reads a brief prepared in advance and answers within a short entry
delay, or (b) reviews after entry and can only cancel or reduce. Signals here are H1/H4 swing
trades, so a delay of up to a minute costs little. This is owner decision A3.

## 6. Models and this machine

Machine checked 2026-11-16: Ryzen 7 7700 (8 cores), 32 GB RAM (15 GB free), RTX 5070 with
12 GB video memory (1.6 GB in use), 1.6 TB free disk.

What that means:

- **Local language models: small ones only.** 12 GB fits roughly a 7 to 14 billion parameter
  model in compressed form. Fine for tagging headlines and extracting fields. Not fine for
  judging a trade: the gap to a frontier model on reasoning is large.
- **The GPU is shared.** The same card runs the Parameter Lab screens and FinBERT, and this is
  also the production host. A local model serving trade decisions would compete with both.
- **Training our own model: not now.** There is no labelled data yet. The decision ledger
  (part E) is what creates it. Revisit when it holds a few thousand scored decisions, and on
  separate hardware (Computer 4 is already deferred to 2027).

Recommended split:

| Work | Model | Why |
|---|---|---|
| Embeddings, FinBERT, FOMC scorer | local GPU | already there, free, private |
| Bulk reading and tagging | smallest API model (Claude Haiku 5.5) | so cheap that a local LLM saves nothing: about $0.10 per million words-in |
| Trade reviewer, Position monitor, Operator | mid or top API model (Claude Opus 5.5 to start) | judgment quality; volume is tiny |
| Daily brief, hard escalations, research | top API model (Claude Fable 5.2) | few calls, highest stakes |
| Offline fallback | none needed | if the API is down, S4 is "unassessed" and trading continues |

The gateway (part D) keeps this vendor-neutral, so another provider's model can be tested in
the same seat. Which model sits where is decided by the scorekeeper, not by reputation.

**Cost, order of magnitude.** Reviewing every incubator and live signal (about 60 a day),
monitoring open trades, bulk reading and one daily brief comes to roughly **$150 to $400 a
month** at list prices, depending on model tier. The research work runs on the existing Claude
subscription. A hard monthly cap in the gateway is part of the design.

**Halving the shadow cost.** A verdict at the observe rung on an incubator signal does not need
an answer in 60 seconds: the context pack is frozen at decision time, so an answer hours later
has seen nothing extra. Those calls go through the provider's batch service, listed at half
price, and only live-book signals and roles at rung 1 or above are answered in real time. The
saving is the list discount; it has not been measured on our volumes.

**The uncomfortable arithmetic.** At 25% a year, a $5,000 account earns about $100 a month.
S4 at full scope costs more than the account earns until the balance is somewhere above
$15,000 to $20,000. So in December and early 2027 S4 is an investment in evidence, and its
scope should be sized to that: cheap tier, shadow only, widen as the account grows.

Data leaving the machine: API calls send signals, positions and context to the provider
(30-day retention on the top model). No broker keys, no account numbers. Owner decision A1.

## 7. Authority ladder and the promotion gate

Each role, per instance, sits on one rung. Moving up is a recorded owner decision.

| Rung | The role may | Who acts |
|---|---|---|
| 0 Observe | write verdicts to the ledger only | nobody |
| 1 Advise | show the verdict in the dashboard and bell | owner |
| 2 Reduce | veto an entry, shrink size, tighten a stop toward profit, close | S4, inside Guardian limits |
| 3 Expand | raise size within ALLOC-v1 bounds | S4, after owner sign-off per strategy |

Standing owner decisions this respects: trade-health actions are advice only (2026-10-30);
the stop may only move toward profit; the Guardian STOP is absolute; real-money gates stay
statistical. Rung 2 for the Position monitor needs a new owner decision that replaces the
10-30 one.

**Promotion gate (draft numbers for the owner to set, registered before any data is seen):**

- at least 200 closed trades with a verdict, over at least 8 weeks, forward only;
- the verdict must beat two baselines, not just "no AI": the current cost filter, and a random
  veto at the same skip rate. (The incubator pool averages about −0.18R, so skipping anything
  looks clever. Only beating a random skip proves judgment.)
- lower bound of the confidence interval on R saved per trade above zero;
- no single strategy or week supplying more than half the benefit;
- zero schema failures or late answers on live-book signals in the last 4 weeks.

The 43 incubator strategies produce a few hundred signals a week, so the Trade reviewer can
reach 200 scored verdicts in weeks. The live book alone (a couple of trades a week) would take
years. That is why the incubator stream is the test bed.

Demotion is automatic: a breach of the same measures over a rolling window drops the role one
rung and rings the bell.

**Additions agreed 2026-11-16** (details in contract C3):

- **Champion and challengers.** Evidence belongs to one model with one prompt (a "trial").
  Because packs are frozen, other trials can answer the same packs in the background. When a
  better prompt appears or the provider retires a model, the replacement already has its own
  record and takes over without an 8-week restart. One challenger at a time under the
  December and January budget.
- **A trial record for prompts and models.** Every trial is registered before its first
  decision, and the gate gets stricter with each one tried in the past 12 months. Trying ten
  and promoting the best scorer is the same overfitting we guard against with strategies.
- **What the owner did with the advice.** At rung 1 every shown verdict records whether it was
  seen and whether it was followed, and the scorecard compares three results on the same
  trades: the strategy untouched, the AI alone, and the owner with the AI. Advice that is never
  opened is a delivery problem; it depends on the phone alert channel (build-plan decision D3).
- **Confidence has to earn its place.** If "high confidence" verdicts do no better than "low"
  ones after 200 scored decisions, the label is hidden.

## 8. Phases

This is a separate workstream. It does not sit on the critical path of the 11-15 build plan
(waves 0 to 5, January go/no-go) and must not delay it.

| Phase | What | Trade influence | Earliest |
|---|---|---|---|
| P0 Foundations | gateway with budget cap and kill switch; `ai` schema and decision ledger; context pack builder; scorekeeper; replay tool | none | after Wave 2 |
| P1 Observe | Reader + context store, with its tags offered to the lab as features; Daily brief; Trade reviewer and Position monitor at rung 0 on incubator and practice signals (batch where timing allows), one challenger; Loss reviewer weekly; Operator read-only | none | December |
| P2 Advise | verdicts in the trade drawer and Overview rows; Operator answers the owner's messages; phone channel | owner clicks | January, after go-live is stable |
| P3 Reduce | rung 2 for whichever role passes the gate, practice instance first, then live | automatic, risk-down only | when the gate passes |
| P4 Expand | rung 3, one strategy at a time | automatic, bounded | after P3 has a clean quarter |
| P5 Own models | fine-tune a local model on the decision ledger; second machine | as earned | 2027 H2 at the earliest |

### Selected feature expansion from the local-LLM specification

The following are compatible additions to the accepted plan. They reuse the same frozen context,
audit, authority and kill-switch boundaries; they do not create a second trading system.

| Addition | How it fits S4 | Phase and limit |
|---|---|---|
| **Local Ollama runtime for bulk work** | Run a private 7B–14B model for document tagging, field extraction, code templates and replayed research summaries. No local model performs trade judgment in P0–P2. | P1; shared GPU is allowed to idle or be evicted, with no effect on live trading |
| **Live state and local RAG** | Index signals, open trades, trade logs, strategy cards, news tags and calendar rows in the existing context store. Queries retrieve a point-in-time slice and return only a structured result. | P1; no web access in judging roles; account identifiers stay out of prompts |
| **News, central-bank and calendar scoring** | Turn source text into the existing Reader tags: instrument, direction hint, importance and known-at time. Store confidence and source provenance, but do not make a broker call. | P1; tags become lab features only; news is never treated as a price prediction |
| **Open-trade diagnostic view** | Read the entry criteria, market change, news catalysts, unrealized drawdown and carry from the frozen context pack; return hold, tighten-toward-profit or close advice. | P1 rung 0; P2 owner-visible only; P3 requires a separate authority decision |
| **Read-only operator interface** | Answer owner questions about forming signals, regime, sentiment, system health and open trades through the local web UI or CLI. | P1/P2; tool allow-list contains read-only state only |
| **Sandboxed research and backtesting** | Let the Researcher propose strategy variations and run them against historical and forward fixtures in an isolated subprocess. | P1; syntax, unit, timeout and risk-boundary checks are mandatory |
| **Autonomous backtest ranking** | Rank candidate rules using Sharpe, drawdown, win rate, profit factor and expectancy in the lab ledger. | P1; every candidate still uses the existing card, pre-registration and kill rules |

**Deliberately not adopted:** a model may not place or modify orders in P0–P2, automatically
raise size, hot-load rewritten live logic, tune active strategy parameters, route orders, or
hold broker keys. Direct execution is a future P3/P4 action only if it passes the existing
Guardian clamps and a new owner decision. The LLM is one evidence source, not the strategy.

**Known limits to carry into design:** local 7B–14B models are not trusted for trade judgment;
API judgment may remain the scorer for P1–P2; the 250 ms probability path is unchanged; and
Ollama or RAG downtime must fall through to "unassessed" without affecting S1–S3.

## 9. What is worth designing heavily

For the people who take this into design:

| Part | Verdict | Reason |
|---|---|---|
| E. Decision ledger + F. Scorekeeper | **Invest heavily, first** | every later decision about S4 depends on this record being honest; cheap to build, impossible to backfill |
| B. Context pack (what the model sees, frozen) | **Invest heavily** | fixes look-ahead, replay, injection and cost in one place |
| Verdict contract and Guardian clamps | **Invest heavily** | the safety boundary; small surface, must be exact |
| Operator role | **Invest** | clear need, low risk, value from day one |
| Reader + context store + live-state RAG | **Invest moderately** | start with 3 or 4 free sources and the existing ledgers; retrieve frozen slices, not a live database dump |
| Local Ollama bulk runtime | **Invest moderately** | useful for extraction, tagging and code templates; never the live judgment seat until a forward record earns it |
| Sentiment and regime text tags | **Invest moderately** | add to the lab as features; require source, known-at time and confidence; no direct sizing from the model |
| Trial record, champion and challengers | **Invest heavily** (part of the ledger) | without it every prompt change costs 8 weeks, and picking the best of many is self-deception |
| Reader tags as lab features | **Invest moderately** | the one AI path with a promising result already (FOMC tone); reuses the lab's rules |
| Loss reviewer | **Design light** | cheap, no risk, and it tests whether the reason codes are the right ones |
| Trade reviewer | **Design light, run early** | the prompt will change weekly; the evidence decides if it deserves more |
| Position monitor | **Design light** | reuse ADR-004 inputs; advice only until the gate |
| D. Gateway | **Keep thin** | a few hundred lines; do not adopt an agent framework for it |
| Multi-agent coordination | **Defer** | a rule-based router is enough until two roles truly need to negotiate |
| Rung 3 sizing-up | **Defer** | no evidence; revisit after P3 |
| Own model / fine-tuning / new hardware | **Defer** | no data yet; revisit at P5 |

## 10. Main risks

| Risk | Guard |
|---|---|
| A convincing but wrong verdict moves money | rungs, schema, Guardian clamp, reduce-only first |
| Look-ahead: model "remembers" the outcome | forward-only scoring; nothing before the model's training cutoff counts (TX-04 guard) |
| Prompt injection from a news page | judging roles have no web access; readers can only write tagged rows |
| Model changes under us (vendor update or retirement) | model id and prompt version pinned and logged; a change is a new trial, and a challenger running beside the champion is ready to take over |
| Picking the best of many prompts by luck | every trial registered first; the gate tightens with the number tried |
| Advice nobody reads | seen and followed rates on the scorecard; phone channel before rung 1 |
| The system is starved of trades | skip rate is capped per strategy per week; owner's "couple of trades a week" is a hard floor |
| Cost creep | monthly cap in the gateway; cost per verdict on the dashboard |
| API outage | "unassessed" path: trading continues on today's rules |
| Building S4 delays live readiness | separate workstream, starts after Wave 2, touches no trade-path code until P3 |

## 11. Owner decisions

**Answered 2026-11-16: the owner accepted all seven recommendations as written ("Yes, accept
all").** The right-hand column is therefore the decision.

| # | Decision | Decided |
|---|---|---|
| A1 | May signals, positions and context be sent to an outside model API? | yes; no keys or account numbers ever |
| A2 | Monthly AI budget cap | $150 for December and January, reviewed with the account size |
| A3 | Entry delay allowed for a pre-trade review | up to 60 s on H1/H4 strategies; none on anything faster |
| A4 | When does P0 start | after Wave 2 of the build plan, shadow only through December |
| A5 | Providers to test in the first seat | one to start (Claude); add a second once the scorekeeper exists |
| A6 | Promotion gate numbers in section 7 | accept as drafted, registered before P1 starts |
| A7 | May an AI verdict ever close a live trade without the owner? | not until the gate passes; then a new decision replacing 2026-10-30 |

## 12. Next step

Done 2026-11-16: `01-design-brief.md` covers the three "invest heavily" parts for phase P0,
with draft contracts in `contracts\` (c1 context pack, c2 verdict and clamps, c3 decision
ledger and scorekeeper). Next: the design review that freezes those contracts (brief step D1),
not before Wave 2 of the 11-15 build has passed its gate.
