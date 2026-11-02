# W45-TUE-1 — Every red or amber state, and its fix

**Status:** built 2026-11-02 by Claude. Umbrella branch `feat/fix-actions` (ab6b582 code, 455861b static),
stacked on `feat/manual-trade-label` (TUE-3). Not deployed.
**Rule (DESIGN-SYSTEM §6):** a red or amber state says what is wrong and offers the fix. The fix is a
control-panel action (the panel previews, confirms and audits it; the dashboard never acts) or, where no
action exists, the exact manual step.

## How a fix works now

The dashboard opens the control panel at `#/<page>/<section>`. The panel scrolls to that section and
outlines it for 4 s (`control-panel/web/src/lib/deepLink.js`). Before this, every fix opened the panel at the
top of the Trading page: TopBar's own opener dropped the hash.

## 1. Verdict chain (top bar, every view)

| Link | State | What the owner sees | Fix |
|---|---|---|---|
| DATA | publisher snapshot stale | "Data stale — state unknown" | Restart the publisher → `#/services/svc` |
| MARKET | closed | "Not trading — market closed" | none (the calendar, not a fault) |
| MARKET | unknown | session state not published | Check in System settings (view) |
| EXEC | **downtime halt** (new) | "System 2 halted new entries after downtime (reasons)" | Resume System 2 → `#/trading/go` |
| EXEC | exec_mode not RUNNING | "exec_mode is X" | System 2 entries → `#/trading/s2` |
| EXEC | queue stale | "queue staleness Ns > limit" | Safe-restart the bridge → `#/services/safe` |
| RISK | PAUSED | "Paused — risk gate" | Resume trading → `#/trading/go` |
| RISK | CIRCUIT_BROKEN | breaker fired | Reset breaker → `#/trading/go` |
| RISK | guardian not ok / heartbeat stale | "guardian status is X" | Check System 3 service → `#/services/svc` |
| SIGNALS | not loaded / unavailable / producing nothing / faulting / suppressed | the S1 evidence line | System 1 jobs → `#/system1/jobs` |
| (none) | no signal for 4 h while armed | "Armed — no signal flow" | none: often the market; read the S1 line |

**Bug fixed:** System 2's DOWNTIME_HALT blocks every new entry while `exec_mode` still reads `RUNNING`
(it lives under `/status.startup.downtime_halt`). The chain never read it, so after every S2 restart the top
bar said **Trading** while nothing could trade. Seen live in DEV on 2026-11-02 (`exec_mode=RUNNING
downtime_halted=True`).

## 2. System view audit checks (29)

| Check | Fix |
|---|---|
| snapshot.passthrough, snapshot.age, payloads.freshness, snapshot.payloads, reconciliation.recorder, kpi, kpi.account_fresh | Restart the publisher → `#/services/svc` |
| positions.consistency, reconciliation, s3.silent_drops | Broker vs System 3 (close orphan / remove phantom) → `#/trading/recon` |
| kpi.positions_vs_snapshot, kpi.equity_vs_s3 | Safe-restart the bridge (snapshot relay) → `#/services/safe` |
| s3.drawdown_recompute | Restart System 3 → `#/services/svc` |
| s2.downtime_halt | Resume System 2 → `#/trading/go` |
| risk.metrics, model.thresholds, health, latency.endpoints, audit.run, audit.loop | Restart the dashboard → `#/services/svc` |
| bundle.shell, bundle.caching, retired.endpoints | step: a dashboard build/deploy problem, not an operating one |
| trades.ledger_vs_broker | step: the "SB trade journal sync (5m)" task; its log |
| control_panel.health | step: write `restart` to `C:\SB\prod\services\run\controlpanel.restart` |
| clock.drift | step: `w32tm /resync` (elevated) |
| s3.time_rules_reported | step: deploy a current System 3 build |
| decisions.funnel, mode.sources | read-outs, no fix (the card says so) |

`check-fixes.test.mjs` fails if a check is added without a fix, or if any link names a panel section that
does not exist.

## 3. Services overview

A service that is not OK has "Restart in control panel" / "Release in control panel" → now `#/services/svc`
(was the page top). System 1 → `#/system1/jobs`.

## Still open (not built)

- **One-click inside the dashboard.** Every fix still goes through the panel's preview + confirm. That is by
  design: the dashboard has no command path.
- **Per-service deep link.** `#/services/svc` lands on the list, not on the one service's card (cards have no
  ids yet).
- **Reconciliation needs judgement.** `#/trading/recon` shows the divergence and offers close-orphan /
  remove-phantom; deciding which is right stays with the owner.
- **Assets view DQ** (e.g. JP225 quarantined, see S1 DQ index spread) shows the stale state without a fix; the
  fix there is a code change, not an action.

## Evidence

Dashboard tests 309/310 (golive-display was already red in prod), gate-truth 37/37, check-fixes 4/4, panel
deepLink 4/4, design-lint at baseline (213 / 18), tsc clean on both. Headless Chrome at 390 px: all six deep
links render, outline and scroll their section, plain page links outline nothing, no exceptions (20/20;
script `ui-check/deeplink.mjs`).

## To deploy (owner)

1. `C:\SB\scalablebrain-umbrella`: `git merge --ff-only feat/fix-actions` (this includes TUE-3).
2. Restart the dashboard (`restart` → `C:\SB\prod\services\run\dashboard.restart`).
3. Panel: `npm ci; npm run build` in `control-panel\web` (its `dist` is not in git), then restart
   `controlpanel` the same way.
