# Contract C3: decision ledger and scorekeeper (DRAFT 2026-11-16, not frozen)

Schema `ai` in `scalable_brain_dev` first; production after the DEV gate, applied by the owner.
Same conventions as the 11-15 build plan: surrogate keys, `instance_key` with no default
(I9), UTC `timestamptz`, append-only enforced by trigger (the `research.forward_trade` pattern),
no grant to the trade path (S1 to S3 logins never read or write `ai.*`).

Migration numbers: the lead confirms the next free numbers in
`telemetry-server/migrations/` at kickoff (020 to 028 are taken by the build plan).

## 1. Tables

```sql
CREATE SCHEMA ai;

-- Which model sits in which seat. A new row is a new seat version; rows are never updated.
CREATE TABLE ai.seat (
  seat_id        bigserial PRIMARY KEY,
  seat_key       text        NOT NULL,          -- 'reviewer-main', 'monitor-main', 'reader-bulk', 'brief'
  provider       text        NOT NULL,
  model_id       text        NOT NULL,          -- exact id sent to the provider
  effort         text,
  active_from    timestamptz NOT NULL,
  created_by     text        NOT NULL,
  UNIQUE (seat_key, active_from)
);

-- Every prompt text ever used, by hash.
CREATE TABLE ai.prompt_version (
  prompt_id      bigserial PRIMARY KEY,
  role           text        NOT NULL,
  version        text        NOT NULL,          -- 'reviewer-1.0.0'; major bump resets the evidence clock
  sha256         char(64)    NOT NULL UNIQUE,
  body           text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, version)
);

-- Every model + prompt combination ever tried for a role, registered BEFORE its first decision.
-- This is the trial record: the gate counts these (section 3), so trying many and promoting
-- the best scorer is paid for. Exactly one trial per role is the champion at any time; the
-- rest are challengers answering the same packs.
CREATE TABLE ai.trial (
  trial_id       bigserial PRIMARY KEY,
  role           text        NOT NULL,
  seat_id        bigint      NOT NULL REFERENCES ai.seat,
  prompt_id      bigint      NOT NULL REFERENCES ai.prompt_version,
  track          text        NOT NULL CHECK (track IN ('champion','challenger')),
  hypothesis     text        NOT NULL,          -- why this one is expected to do better, in a sentence
  registered_at  timestamptz NOT NULL DEFAULT now(),
  registered_by  text        NOT NULL,
  UNIQUE (role, seat_id, prompt_id)
);
-- A trial ends, or a challenger takes the champion's place, by a new row here (never an update).
CREATE TABLE ai.trial_event (
  event_id       bigserial PRIMARY KEY,
  trial_id       bigint      NOT NULL REFERENCES ai.trial,
  event          text        NOT NULL CHECK (event IN ('retired','became_champion','became_challenger')),
  at             timestamptz NOT NULL DEFAULT now(),
  by             text        NOT NULL,
  reason         text        NOT NULL
);

-- What the model saw. Body validates against c1-context-pack.schema.json.
CREATE TABLE ai.context_pack (
  pack_id        uuid        PRIMARY KEY,
  pack_hash      char(64)    NOT NULL,
  role           text        NOT NULL,
  instance_key   text        NOT NULL,
  subject_type   text        NOT NULL CHECK (subject_type IN ('signal','open_trade')),
  subject_id     text        NOT NULL,
  as_of          timestamptz NOT NULL,
  built_at       timestamptz NOT NULL,
  builder_version text       NOT NULL,
  body           jsonb       NOT NULL
);

-- One row per model call, valid or not. Several trials may answer one pack: one row each.
CREATE TABLE ai.decision (
  decision_id    uuid        PRIMARY KEY,
  pack_id        uuid        NOT NULL REFERENCES ai.context_pack,
  trial_id       bigint      NOT NULL REFERENCES ai.trial,
  role           text        NOT NULL,
  instance_key   text        NOT NULL,
  seat_id        bigint      NOT NULL REFERENCES ai.seat,
  prompt_id      bigint      NOT NULL REFERENCES ai.prompt_version,
  delivery       text        NOT NULL CHECK (delivery IN ('realtime','batch')),
                                                 -- batch: observe-rung decisions off the live book,
                                                 -- answered up to 24 h later from the same frozen pack
  requested_at   timestamptz NOT NULL,
  answered_at    timestamptz,
  status         text        NOT NULL CHECK (status IN
                   ('ok','invalid_schema','invalid_evidence','timeout','refused','error','budget_blocked')),
  action         text,                           -- NULL unless status = 'ok'
  size_multiplier numeric(3,2),
  confidence     text,
  reason_codes   text[],
  evidence_ids   text[],
  note           text,
  raw_response   jsonb,                          -- kept even when invalid
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(10,5),
  rung           smallint    NOT NULL,           -- the role's rung on this instance at request time
  effect         text        NOT NULL CHECK (effect IN ('none','shown','applied','ignored_clamp')),
                                                 -- only a champion's decision can be shown or applied
  UNIQUE (pack_id, trial_id)
);

-- What the owner did with advice that was shown (rung 1). One row per shown decision,
-- written when the trade closes or the advice expires.
CREATE TABLE ai.owner_action (
  decision_id    uuid        PRIMARY KEY REFERENCES ai.decision,
  shown_at       timestamptz NOT NULL,
  channel        text        NOT NULL,           -- 'drawer', 'bell', 'phone'
  seen_at        timestamptz,                    -- NULL = never opened
  action         text        NOT NULL CHECK (action IN ('followed','ignored','opposite','not_seen')),
  acted_at       timestamptz,
  r_as_owner_traded numeric(8,4)                 -- net R of what actually happened
);

-- Baselines drawn AT decision time, so they cannot be chosen after the outcome is known.
CREATE TABLE ai.baseline_draw (
  decision_id    uuid        NOT NULL REFERENCES ai.decision,
  baseline       text        NOT NULL CHECK (baseline IN ('random_veto','cost_filter')),
  size_multiplier numeric(3,2) NOT NULL,         -- random: drawn from the role's trailing 28-day
                                                 -- multiplier distribution with a stored seed;
                                                 -- cost_filter: Layer X's shadow multiplier
  seed           bigint,
  PRIMARY KEY (decision_id, baseline)
);

-- What happened. Written once by the scorekeeper when the trade closes.
CREATE TABLE ai.outcome (
  decision_id    uuid        PRIMARY KEY REFERENCES ai.decision,
  source         text        NOT NULL CHECK (source IN ('forward_ledger','trading_trade')),
  source_id      text        NOT NULL,           -- research.forward_trade id or trading.trade id
  closed_at      timestamptz NOT NULL,
  r_unfiltered   numeric(8,4) NOT NULL,          -- net R of the trade as the strategy took it
  r_after_exit_advice numeric(8,4),              -- monitor only: net R had the advice been followed
                                                 -- at the next bar open after answered_at
  cluster_key    text        NOT NULL,           -- iso week || ':' || currency or index group
  scored_at      timestamptz NOT NULL DEFAULT now()
);

-- Rung history. The current rung is the latest row; the effective value the trade path
-- sees comes from the settings snapshot (config schema), which the owner activates.
CREATE TABLE ai.rung_change (
  change_id      bigserial PRIMARY KEY,
  role           text        NOT NULL,
  instance_key   text        NOT NULL,
  rung           smallint    NOT NULL CHECK (rung BETWEEN 0 AND 3),
  changed_at     timestamptz NOT NULL DEFAULT now(),
  changed_by     text        NOT NULL,           -- owner id, or 'scorekeeper' for a demotion
  reason         text        NOT NULL
);

-- The gate, registered before data. One row per role; never updated.
CREATE TABLE ai.gate_registration (
  role           text        PRIMARY KEY,
  registered_at  timestamptz NOT NULL DEFAULT now(),
  spec           jsonb       NOT NULL,           -- section 3 below, as data
  spec_sha256    char(64)    NOT NULL
);
```

Every table has a `BEFORE UPDATE OR DELETE` trigger that raises; there are no exceptions.
A wrong row is corrected by a new row in an `ai.correction` table that names it; the
scorekeeper reads corrections. (Design the correction table with the db agent; keep it small.)

Views: `ai.v_spend_month` (sum of `cost_usd` by month, role, seat; the gateway reads it for
check A9), `ai.v_scorecard` (section 2), `ai.v_unscored` (ok decisions whose trade closed more
than 24 h ago with no outcome row: must be empty, alert if not).

## 2. What the scorekeeper computes

Evidence belongs to a **trial** (one model + one prompt major version), never to a role as a
whole. Evidence set for a trial = its decisions with `status='ok'` and an outcome row, with
`as_of` after the model's training cutoff, after `ai.gate_registration.registered_at` and after
the trial's own `registered_at`. A new model or a major prompt change is a new trial with an
empty set. Because challengers answer the same packs as the champion from the day they are
registered, a replacement can already hold its own 200 scored decisions when it is needed
(a better prompt, or the provider retiring a model): it becomes champion by a `trial_event`,
with no gap and no restart. Realtime and batch decisions both count; the pack is frozen at
`as_of`, so a late answer has seen nothing extra.

Trade reviewer, per decision *i* with multiplier *m_i* and unfiltered result *R_i*:

- benefit of the verdict: `b_i = -(1 - m_i) * R_i` (R not lost by trading smaller or not at all;
  negative when it cut a winner);
- the same with each baseline's multiplier: `b_i(random)`, `b_i(cost)`;
- edge over a baseline: `d_i = b_i - b_i(baseline)`.

Reported per role (and per strategy, never promoted per strategy): n, skip and shrink share,
mean `b`, mean `d` against each baseline, and a 90% interval on each mean from a bootstrap that
resamples **clusters** (`cluster_key`), 10,000 draws, because legs of one move are not
independent trades. Also: share of total benefit from the largest strategy and the largest
week; status counts (how often the role failed to answer); cost per ok decision.

Position monitor: `d_i = r_after_exit_advice - r_unfiltered` for close advice, 0 for hold, with
the same clustering, against a random-close baseline at the same rate.

Also on the scorecard, for information and never part of the gate:

- **Champion against each challenger** on the packs both answered: paired difference in `b`,
  clustered interval, and how often they disagree.
- **Confidence check:** mean `d` split by `confidence`. If after 200 scored decisions "high" does
  not beat "low" (interval on the difference spans 0), the field is hidden from the owner's
  view and noted as uninformative; it stays in the record.
- **Owner follow-through** (rung 1, from `ai.owner_action`): share of advice seen, share
  followed, and three results on the same trades: the strategy untouched, the AI's verdict
  alone, and what the owner actually did. Advice that is never seen is a delivery problem and
  is reported as such, not as the role's failure.

## 3. Promotion gate, as registered (owner decision A6)

A role may be proposed for the next rung on an instance when its **champion trial**, on its
own evidence set, shows:

1. n ≥ 200 scored decisions over ≥ 8 calendar weeks;
2. lower bound of the interval on mean `d` > 0 against **both** baselines, where the interval
   level is `1 - 0.10 / k` and `k` is the number of trials registered for the role in the
   trailing 12 months (k = 1 gives 90%; ten trials give 99%). Trying more costs certainty;
3. no strategy and no week supplies more than 50% of total benefit;
4. on live-book signals in the last 4 weeks: 0 `invalid_*` and 0 `timeout`;
5. `ai.v_unscored` empty.

Passing makes a proposal on the dashboard. The owner activates the rung as a settings change.
Demotion: if on the trailing 100 scored decisions the mean `d` against random is below 0 at
the 90% level, or status failures exceed 5% in a week, the scorekeeper writes a rung_change one
rung down, flags the role in the snapshot, and rings the bell.

## 4. Acceptance fixtures ("if it reports clean, it is broken")

| Fixture | Must show |
|---|---|
| a reviewer that skips everything, on a pool with mean −0.18R | large positive `b`, but `d` against random ≈ 0: gate fails on line 2 |
| a reviewer with multipliers assigned by coin flip | interval on `d` spans 0 |
| a reviewer that sees the outcome (planted look-ahead) | pack builder refuses: `known_at > as_of` |
| a synthetic reviewer that removes the worst 20% by construction | gate passes; proves the harness can pass |
| 200 decisions that are 20 moves × 10 correlated legs | clustered interval much wider than the naive one |
| ten coin-flip reviewers registered as ten trials; the best one is put forward | gate fails: the level for k = 10 is 99%, and the best of ten random ones does not clear it |
| the same best-of-ten with the other nine trials left unregistered | refused: a decision cannot be stored without a `trial_id` registered before it |
| a challenger with 200 scored decisions replaces a retired champion | role keeps its rung with no gap; the old trial's evidence is not counted for the new one |
| a batch decision answered 20 h after `as_of` on a trade that closed after 2 h | scored normally; the pack hash proves the model saw only what was known at `as_of` |
| advice shown but never opened | `owner_action.action = 'not_seen'`; excluded from "followed" and "ignored" shares |
| UPDATE or DELETE on any `ai` table | error from the trigger |
| a decision whose trade closed 25 h ago, no outcome | appears in `ai.v_unscored` |
