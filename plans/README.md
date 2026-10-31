# Task plans: road to December and the probability check

Each task on the weekly plan page (`week.html`) that has a **Plan** link points to a file
in this folder. Every plan is written so that **an agent with no memory of the
conversation that created it can pick it up and finish it.** Read this README first, then
the task's plan.

Created 2026-10-31 from the owner's architecture review of S1, the gating model, the regime
strategy map, FinBERT and a "probability check". The owner agreed every recommendation in
that review. The summary below is the part an agent needs.

## What the review found (the facts the plans rest on)

- **The S1 gatekeeper filters a losing pool.** In the live model card
  (`C:\SB\prod\state\model-cache\sets\<latest>\model_card.json`), all candidate trades
  have an expectancy of −0.087R and approved trades −0.060R. A filter can only reduce the
  loss of a pool with no edge. It cannot turn it positive.
- **What it learned is mostly trade geometry.** R:R carries 36% of the gain, TP distance
  26% and SL distance 19%. Market state carries about 17%. In effect it learned that far
  targets get hit less often, which is arithmetic, not insight.
- **Its label is wrong for the job.** `is_winner` ignores payoff, so a 30% winner at 3R
  and a 60% winner at 0.5R look alike. The fix is triple-barrier labels and expected R
  (PC-02, PC-04).
- **It is overconfident.** In the most populated bin, a predicted 0.46 corresponds to an
  observed 0.33. Its probabilities cannot size trades until it is recalibrated.
- **XGBoost itself is not the bottleneck.** Swapping boosting libraries is worth a point
  or two. The gains are in the label, calibration and inputs. The bake-off (PC-04) is
  logistic regression vs XGBoost vs LightGBM, and the simplest model that ties wins.
- **"Offline brain" means three things, and each gets its own answer:**
  - Weekly batch retraining stays. There is no online learning: with this little data on
    a non-stationary market it would chase noise.
  - Inference should become **event-driven on bar close** (ON-01).
  - The system should gain **live context** (the probability check) and **online
    monitoring** of calibration and drift (PC-06).
- **FinBERT** (ProsusAI) was trained on equity news and scores 0.56 on FX headlines,
  against about 0.79 for an LLM. Headline sentiment does not forecast FX direction at our
  speed. Text is worth trying only on **central-bank communication**. The alternatives
  are tested in TX-01. Text never gates a trade until it has earned that.
- **The probability check** estimates P(price reaches X% of TP before SL within the hold
  window | all evidence). Each supporting system (base rate, market-state model,
  volatility forecast, tone, cross-asset) produces its own score. A **stacking model
  fitted out of sample** combines them; naive averaging or multiplying would count
  correlated sources twice. A source whose fitted weight is near zero is dropped. The
  output is expected R, which first **modulates size, not veto**: the owner wants at least
  a couple of trades a week.
- **Every new source starts in shadow.** Its score is logged at signal time with no vote
  (PC-01), so that after 2–3 months each source can be measured.

## Rules every agent follows (non-negotiable)

1. **Work in DEV.** Code lives in the dev monorepo `C:\SB\dev\systems\<brain|hand|guardian|bridge>`
   on branch `dev`. Prod (`C:\SB\prod\repo`) changes only by an owner-approved deploy.
   Never push to remotes unless a plan says so.
2. **App Control blocks new venvs and native DLLs.** Run with
   `C:\SB\venv-s1\Scripts\python.exe` and treat it as **read-only**. **Never `pip install`
   into it.** Available: xgboost 3.2, lightgbm 4.6, scikit-learn 1.8, optuna 4.8,
   transformers 5.4, torch 2.11 (CUDA). Missing: catboost, arch, statsmodels, anthropic.
   Implement HAR or GARCH with numpy and sklearn, and call LLM APIs over plain HTTPS
   (`requests` / `urllib`). **Exception, research only:** CatBoost 1.2.10 lives in
   `C:\SB\lab\pydeps\catboost-1.2.10`. Use it with `PYTHONPATH` on research runs only,
   never on a live path (see `C:\SB\lab\pydeps\README.md`). Anything that needs a new package is an **owner decision**;
   write it up and stop.
3. **No look-ahead.** Every feature uses only data with a timestamp ≤ the decision time.
   Every evaluation uses purged, embargoed walk-forward splits, never random K-fold.
   LLM scores on text published **before the model's training cutoff are contaminated**
   and never count as evidence (TX-04).
4. **The forward record is sacred.** `research.forward_trade` is append-only and
   trigger-frozen. Never edit it and never use `shadow_replay` as the record. New evidence
   goes in new append-only tables.
5. **Honest reporting.**
   - Report out-of-sample numbers with confidence intervals and the number of trials.
   - Correlated basket legs are not independent trades.
   - A null result is written as a null result.
   - R-multiples are never rendered as percentages.
6. **Free data only** until the system is profitable (owner rule). A paid API is an owner
   decision. LLM API spend is metered, so log the cost.
7. **Shadow first.** Nothing in this program changes a live trading decision until its
   promotion task (PC-07) is approved by the owner in writing.
8. **Design system.** Any UI follows `C:\SB\Scalablebrainfullarchitecture\DESIGN-SYSTEM.md`
   (IBM Plex, tokens, the fix-it rule).
9. **Finishing a task:**
   - Commit on `dev` with a message that names the task ID.
   - Append a dated "Result" section at the bottom of the plan file. Never rewrite the
     plan above it.
   - Leave the task unticked: **the owner ticks** it on the week page.
   - If blocked, set the task's `status` to `blocked` with a `note` explaining why, in
     `data/week-plans/<week>.json`.

## Task index

| ID | Title | Week | Depends on |
|---|---|---|---|
| [PC-00](PC-00-adr-005-probability-check.md) | ADR-005 probability check design, owner review | W45 | none |
| [PC-01](PC-01-evidence-ledger.md) | Evidence ledger: log every source's score at signal time (shadow) | W45–W46 | PC-00 |
| [PC-02](PC-02-triple-barrier-labels.md) | Triple-barrier labels from rebuilt price paths | W46 | none |
| [PC-03](PC-03-volatility-forecaster.md) | Volatility forecaster (HAR-RV) and reach-probability feature | W46 | none |
| [PC-04](PC-04-gatekeeper-v3-bakeoff.md) | Gatekeeper v3 bake-off: LR vs XGB vs LightGBM, new label, calibration | W47 | PC-02, PC-03 |
| [PC-05](PC-05-stacking-combiner.md) | Stacking combiner, expected R output (shadow) | W48 | PC-01, PC-04, TX-01 |
| [PC-06](PC-06-live-calibration-drift.md) | Live calibration and drift monitor, dashboard panel | W48 | PC-01 |
| [PC-07](PC-07-promotion-review.md) | Promotion review: expected R as size modulator | W49+ | PC-05, PC-06, ≥4 weeks shadow |
| [TX-01](TX-01-text-model-bakeoff.md) | Text-model bake-off: FinBERT vs alternatives vs LLM | W46 | TX-04 |
| [TX-02](TX-02-event-calendar.md) | Economic event calendar and event-risk feature | W46 | none |
| [TX-03](TX-03-morning-briefing.md) | Morning briefing bell (advisory only) | W47 | TX-02 |
| [TX-04](TX-04-lookahead-guard.md) | Look-ahead guard for model-scored text | W45 | none |
| [LR-01](LR-01-order-idempotency.md) | Order idempotency and startup reconcile: verify and close | W46 | none |
| [LR-02](LR-02-slippage-geometry.md) | Slippage bound and post-fill geometry check | W46 | none |
| [LR-03](LR-03-execution-mode-gate.md) | Execution-mode config gate (shadow / practice / live) | W46 | none |
| [LR-04](LR-04-risk-config-live.md) | `risk_config.live.json` profile | W47 | none |
| [LR-05](LR-05-circuit-breaker-latch.md) | Circuit-breaker latch and owner reset | W47 | none |
| [LR-06](LR-06-spread-stale-quote-gate.md) | Spread-widening and stale-quote admission gate | W47 | none |
| [LR-07](LR-07-s1-emit-idempotency.md) | S1 signal-emit idempotency and dead-letter | W47 | none |
| [PC-08](PC-08-probability-trade-management.md) | Probability-driven trade management (partial TP, break-even) | W48 | PC-02, PC-05 |
| [ON-01](ON-01-bar-close-inference.md) | Event-driven bar-close inference (design, then DEV) | W49 | PC-01 |
| [ON-02](ON-02-regime-router-vs-feature.md) | Regime as router vs as feature: walk-forward study | W48 | PC-02 |

The LR tasks restate open items from `C:\SB\dev\DECEMBER-READINESS.md`. **Part of that
register is stale.** For example, S2 already sends `clientExtensions.id` (F-303) and has
`priceBound` limits in `execution_limits.py`. Every LR task therefore **starts by verifying
what already exists** and closes only the real gap.

## Owner decisions (answered 2026-10-31)

- **D5, size and block.** The bands apply to calibrated P(TP hit):
  - below ~30%: block
  - 30–60%: reduced size (0.5x)
  - 60–85%: normal size, rising toward 1.25x
  - ~90% and above: up to 1.5x

  Every size stays inside S3's caps. High probability also drives trade management:
  partial TP and break-even (PC-08). The bands are confirmed at PC-07 against calibration
  evidence. Caveat: P(full TP) falls with target distance, so a fixed 30% floor must not
  silently block positive-expected-R wide-target trades. PC-07 checks this.
- **D6, text models.** Test them all. FinBERT is one probability source among several.
  FOMC-RoBERTa is research only (CC BY-NC). Claude scores count only on text published
  after its training cutoff.
- **D7, CatBoost.** Include it as a test, not a replacement. Choose from an ensemble
  comparison, and XGBoost stays incumbent unless beaten. It is installed research-only
  (see rule 2).
