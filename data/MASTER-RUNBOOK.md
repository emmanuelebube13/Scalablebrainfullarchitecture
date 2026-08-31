# ScalableBrain — Master Access & Operations Runbook

**Everything an agent or a human needs to reach, change, deploy, restart and verify every
part of this platform: System 1, System 2, System 3, the bridge, the trading VM, the Cloud
Run dashboard, the cloud data plane, and OANDA.**

Compiled 2026-08-31. Every value marked **[LIVE]** was read from the running system on that
date — the VM over IAP, the Cloud Run service, GCS, Pub/Sub, Secret Manager and the service
health endpoints — not from documentation. Values marked **[DOC]** come from the deployment
guide and are unverified or stale; where live state contradicts a doc, §20 records the
correction.

---

## 0. How to use this document

### 0.1 On secrets

This file names **every** secret the platform uses, says exactly where each one lives, and
gives the exact command to read it and the exact command to rotate it. It does not paste the
credential values themselves.

That is deliberate, and it is not a limitation of your access — you have the permissions to
read all of them, and §4 gives the one command for each. Pasting live values here would put
the OANDA broker key, the Postgres password, the Redis token, the dashboard token and the
Telegram bot token into a markdown file inside a git repository. That is finding **F-108**
happening again (an agent wave did exactly this on 2026-08-21 with
`cloud/telemetry-web/env-vars.yaml`), and it would make the file wrong the moment anything
rotates. Read each secret from its authoritative source at the moment you need it.

**If you are an agent:** you may read any secret listed here using the commands given. Do
not copy the values into any file, commit, log line, report, prompt, or message.

### 0.2 What this document is not

It is not permission to deploy. §1 is a hard list of things that are never done, and §14
requires a human gate before any restart that interrupts live execution.

### 0.3 Reading order for a cold start

1. §1 invariants — non-negotiable.
2. §2 system map — where everything actually runs.
3. §19 known traps — the ways this platform has already been broken.
4. Then the section for whatever you are touching.

---

## 1. Standing invariants — never do these

These hold for every task, every agent, every session. They are not scoped to one change.

| # | Invariant |
|---|---|
| I-1 | **Never** set `go_live_enabled`. **Never** flip a mode to `enforce` that is not already `enforce`. **Never** flip `OANDA_ENV` to `live`. |
| I-2 | **Never** place, modify, or cancel a broker order by hand — not via the OANDA API, not via a script, not via `force_demo_order.py` against the live account. |
| I-3 | **Never auto-remediate.** Report the problem; a human decides the fix. This includes resetting circuit breakers, clearing RECOVERY, draining queues, and deleting parked messages. |
| I-4 | **Absent must render as absent.** No `COALESCE(x, 0.5)`, no `|| 0`, no defaulted direction, no invented fallback. A confident wrong number is worse than a blank panel. |
| I-5 | **Never edit anything under `audit/` to make it pass.** Those harnesses are defect witnesses — several pass *because* a bug exists. A red harness is evidence, not a chore. |
| I-6 | **Never regex- or script-patch a source file.** Targeted edits only, then `python -c "import ast; ast.parse(open(f).read())"` on every file touched, plus the duplicate-def check in §17.4. |
| I-7 | **Never derive trade direction** from a regime label, the sign of a score, a trend indicator, or anything the model set did not explicitly declare. This is the deleted 2026-08-15 defect; reintroducing it is the single worst outcome available. |
| I-8 | **Never install Claude Code (or any agent CLI) on `trading-1`.** A staged copy of the old chat agent host is still at `/opt/scalablebrain/bridge/chat_agent_host.py`; it is inert *only* because `claude` is absent. Installing one silently re-arms remote code execution next to the broker key (F-403). |
| I-9 | **Never `git push` from an agent session** unless the user asked for it in that session. |
| I-10 | **Restarting a service is not evidence.** Calling the endpoint and comparing the answer to the source of truth is. |
| I-11 | **Never copy a file wholesale between the repo and production** without diffing both directions first. They have diverged file by file, in both directions. See §14. |
| I-12 | **Never widen scope.** An agent asked to fix a watchdog check also changed `PRODUCER_MAX_SEC` and added Telegram send-failure tracking. Neither was reviewed; both were dropped. |

---

## 2. The system map

### 2.1 Physical placement — where each thing actually runs

| Component | Runs on | Path / identity | Status **[LIVE]** |
|---|---|---|---|
| **System 1 — The Brain** (training, regime HMM, gatekeeper, strategy catalogue) | "Computer 1", a Windows workstation, **intermittent** | local `scalable-brain/` tree; PostgreSQL 16 + TimescaleDB, DB `ForexBrainDB` on `localhost:5432` | Off-cloud. Publishes to GCS when online. **No signal emitted since 2026-08-26T21:15Z.** |
| **System 2 — The Hand** (execution engine, OANDA adapter) | GCE VM `trading-1` | `/opt/scalablebrain/system2/system-2-execution-engine`, unit `system2`, `127.0.0.1:8002` | active, NRestarts=0, `exec_mode: RUNNING` |
| **System 2 model downloader** | `trading-1` | unit `s2-downloader` | active, enabled |
| **System 3 — The Guardian / AMS** (risk gate, sizing, breakers, journal) | `trading-1` | `/opt/scalablebrain/system3/ams`, unit `s3-ams`, `127.0.0.1:8300` | active, NRestarts=0, `mode: enforce`, `state: RECOVERY` |
| **S2↔S3 bridge** (contract translator) | `trading-1` | `/opt/scalablebrain/bridge/s2s3_bridge.py`, unit `s2s3-bridge` | active, NRestarts=0 |
| **Signal relay** (Pub/Sub → local queue, inbound leg only) | `trading-1` | `system3/ams/scripts/pubsub_signal_relay.py`, unit `s3-signal-relay` | active, NRestarts=0 |
| **Telemetry publisher** (health surfaces → GCS snapshot) | `trading-1` | `/opt/scalablebrain/bridge/telemetry_publisher.py`, unit `telemetry-pub` | active, NRestarts=0 |
| **Ops watchdog** (pages Telegram on running-but-not-working) | `trading-1` | `/opt/scalablebrain/bridge/ops_watchdog.py`, unit `ops-watchdog` (oneshot) + `ops-watchdog.timer` | timer active, ~30 min cadence. The unit reads `inactive (dead)` between fires — correct for a oneshot, not a fault. |
| **Telemetry dashboard** (FastAPI backend + built React SPA) | **Cloud Run**, `europe-west1` | service `telemetry-dashboard`, deployed from `cloud/telemetry-web` | serving, traffic `latestRevision: true` at 100% |
| **Dashboard front-end source** | this repo (authoritative) | `telemetry-dashboard/` → built bundle copied into `cloud/telemetry-web/static/` | — |
| **Analytics Postgres** | **Cloud SQL** | instance `telemetry-db`, POSTGRES_15, db-f1-micro, `34.52.232.110`, europe-west1-b | RUNNABLE |
| **System 2 trade-record Postgres** | `trading-1` | PostgreSQL **18.4**, `127.0.0.1:5432`, database `system2` | listening |
| **Redis** | Upstash (external) | reached via `REDIS_URL` from Cloud Run only | — |

### 2.2 The money path

```
[System 1 on Computer 1]
        │ publishes model set + gatekeeper champion
        ▼
gs://scalable-brain-artifacts/   (latest.json, models/gatekeeper/latest.json, system1/…)
        │                                    │
        │ S2 downloader polls (900 s)        │  (no live signal producer — see §9.3)
        ▼                                    ▼
[S2 model cache]                    Pub/Sub  scored_signal_queue
                                             │  s3-signal-relay (inbound leg only)
                                             ▼
                              shared SQLite queue.db  ──►  [System 3 gate]
                                                                │ approved orders
                                                                ▼
                                                      [bridge s2s3_bridge.py]
                                                                ▼
                                                      [System 2 executor] ──► OANDA practice
                                                                │ fills
                                                                ▼
                                                      [bridge] ──► [System 3 tracking]

[S2 :8002 /health] + [S3 :8300 /health]
        └──► telemetry_publisher.py ──► gs://…/telemetry/latest.json
                                              └──► Cloud Run telemetry-dashboard ──► browser
```

The **shared queue** is one SQLite file, `/opt/scalablebrain/shared/queue/queue.db`, used by
System 2, System 3 and the bridge. Both systems configure it by **absolute path** — they
once ended up on two separate, never-connected queues because each resolved a relative path
from its own working directory.

### 2.3 The two deploy paths, which are completely different

| Target | Source of truth | How code gets there |
|---|---|---|
| **`trading-1`** (S2, S3, bridge, publisher, relay) | **The VM is authoritative.** `/opt/scalablebrain` is **not a git checkout** — no `.git`, no remote, no deploy script. | Manual, file by file, after a two-way diff. §14. |
| **Cloud Run dashboard** | **This repo is authoritative.** | `gcloud run deploy --source .` from `cloud/telemetry-web`. §15. |

Editing this repository changes **nothing** on the VM. Restarting a VM service after editing
the repo restarts the *old* code and looks like a successful deploy.

---

## 3. Identity and access

### 3.1 The human / workstation identity

| Thing | Value **[LIVE]** |
|---|---|
| Active gcloud account | `emmanuelebubembachu@gmail.com` |
| Active project | `scalable-brain` |
| Project number | `400868689848` |
| Default region | `europe-west1` |
| VM zone | `europe-west1-b` |
| Usage reporting | disabled |

This account is **project owner**. It can read every secret, deploy Cloud Run, SSH the VM,
and change IAM. Treat every command in this document as running under it unless stated
otherwise.

```bash
gcloud config list                 # confirm account + project before anything
gcloud auth list                   # confirm the active credential
gcloud config set project scalable-brain
```

If auth has expired, the user must run this themselves (it opens a browser):

```
! gcloud auth login
```

### 3.2 Reaching the VM

```bash
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain --tunnel-through-iap
```

Non-interactive, for scripted checks:

```bash
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain \
  --tunnel-through-iap --quiet --command='<command>'
```

Facts about this path:

- **There are no inbound ports.** `ss -tlnp` shows only `:22`, and `:22` is reached through
  the **IAP tunnel** — the VM has no external IP. `8002`, `8300` and `5432` bind
  `127.0.0.1` only and are unreachable from outside the box.
- The SSH login user is `emman` (your Google identity via OS Login). The **services** run as
  `trader`. You will need `sudo` for almost everything under `/opt/scalablebrain`.
- **The Tailscale route (`ssh eem@100.73.194.56`) does not work** from the Windows
  workstation — it times out. Do not retry it; use IAP.
- `gsutil` is **broken** on this workstation (`python3.14: command not found`). Use
  `gcloud storage` for every bucket operation.

### 3.3 Service accounts — what actually exists **[LIVE]**

| Service account | Purpose | Used by |
|---|---|---|
| `400868689848-compute@developer.gserviceaccount.com` | Default compute SA. `roles/storage.objectViewer` on `gs://scalable-brain-artifacts`, `roles/cloudbuild.builds.builder` on the project. | **Cloud Run runtime identity** for `telemetry-dashboard`, and source-deploy builds. |
| `system1-rw@scalable-brain.iam.gserviceaccount.com` | Read-write on the artifacts bucket. | System 1 publishing model sets; also the key baked into the VM at `system2/.../config/gcp-sa.json`. |
| `trading-vm@scalable-brain.iam.gserviceaccount.com` | `roles/storage.objectUser` on the artifacts bucket — read models, write telemetry/exports. | Attached to the `trading-1` VM instance (ADC). |
| `system2-ro@scalable-brain.iam.gserviceaccount.com` | Read-only. | Provisioned; verify before assuming a workload uses it. |

> **[DOC vs LIVE]** `deployment-guide/01-GCP-SETUP.md` instructs you to create
> `system2-exec@…` and `system3-ams@…`. **Neither exists.** Do not write commands, IAM
> bindings or docs against those names. See §20.

### 3.4 Enumerating your own access

```bash
gcloud projects get-iam-policy scalable-brain --format=json | head -100
gcloud iam service-accounts list --project scalable-brain
gcloud secrets list --project scalable-brain
gcloud storage buckets list --project scalable-brain --format='value(name)'
gcloud run services list --region europe-west1
gcloud compute instances list
gcloud pubsub topics list --project scalable-brain
gcloud sql instances list --project scalable-brain
```

---

## 4. Secrets register

Every credential in the platform, where it lives, how to read it, how to rotate it.

### 4.1 Google Secret Manager — the cloud secrets **[LIVE]**

Three secrets, all created 2026-08-21, automatic replication. Cloud Run mounts each as an
env var via `secretKeyRef` with key `latest`, so a new version is picked up on the next
revision.

| Secret name | Env var in Cloud Run | What it is |
|---|---|---|
| `telemetry-database-url` | `DATABASE_URL` | Postgres DSN for Cloud SQL `telemetry-db` (`34.52.232.110`, database `scalable_brain`). |
| `telemetry-redis-url` | `REDIS_URL` | Upstash Redis connection URL, token embedded. |
| `telemetry-token` | `TELEMETRY_TOKEN` | The single shared bearer token gating every `/api/*` route on the dashboard. |

**Read a value:**

```bash
gcloud secrets versions access latest --secret=telemetry-token --project=scalable-brain
gcloud secrets versions access latest --secret=telemetry-database-url --project=scalable-brain
gcloud secrets versions access latest --secret=telemetry-redis-url --project=scalable-brain
```

**List versions / audit history:**

```bash
gcloud secrets versions list telemetry-token --project=scalable-brain
```

**Rotate** (add a new version, then redeploy or restart the revision so it is picked up):

```bash
printf '%s' '<new-value>' | gcloud secrets versions add telemetry-token \
  --data-file=- --project=scalable-brain
gcloud run services update telemetry-dashboard --region europe-west1 \
  --project scalable-brain --update-secrets TELEMETRY_TOKEN=telemetry-token:latest
```

After rotating `telemetry-token`, open the site once with `?token=<new-token>` on **each**
device — the browser caches it in local storage.

There is also an older, still-documented rotation path that sets the token as a **plain env
var** rather than a secret reference:

```bash
gcloud run services update telemetry-dashboard --region europe-west1 \
  --project scalable-brain --update-env-vars TELEMETRY_TOKEN=<new-random-token>
```

Prefer the `--update-secrets` form. The plain form takes the value out of Secret Manager's
audit trail and puts it in the service description, where `gcloud run services describe`
prints it.

### 4.2 Secrets on `trading-1` — the VM secrets **[LIVE]**

| Path | Mode / owner | Contents |
|---|---|---|
| `/opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2` | `0664 trader:trader` | **The broker keys.** `OANDA_PRACTICE_API_KEY`, `OANDA_LIVE_API_KEY`, account ids, `BYPASS_CONFIRM_TOKEN`, `DB_DSN` (local Postgres). |
| `/opt/scalablebrain/system2/system-2-execution-engine/config/gcp-sa.json` | `0666 trader:trader` | GCP service-account key (`system1-rw`). Used for GCS reads/writes by S2 and the publisher. |
| `/opt/scalablebrain/system3/ams/config/.env.system3` | `0600 trader:trader` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TO`. **System 3 never holds the OANDA key** — broker access lives in System 2 only. |
| `/etc/scalablebrain/telemetry.env` | `0644 root:root` | `TELEMETRY_OBJECT` only. Not a secret; it selects which GCS object the publisher writes. |
| `/opt/scalablebrain/.env`, `/opt/scalablebrain/.env_system1` | `0644 trader:trader` | Legacy System 1 leftovers on the VM. Nothing on the VM reads them. |
| `/opt/scalablebrain/system2/.../config/.env.system2.bak-*` (3 files) | `0600` | Pre-change backups. Still contain live-shaped credentials. |
| `/opt/scalablebrain/backups/*/.env.system2` (2 copies) | varies | Deploy backups holding credentials. |

**Read them:**

```bash
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain --tunnel-through-iap --quiet \
  --command='sudo cat /opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2'
```

**Read only the key names, values redacted** — use this in reports and when you only need to
confirm a name exists:

```bash
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain --tunnel-through-iap --quiet \
  --command='sudo sed -E "s/^([A-Za-z_0-9]+)=.*/\1=<redacted>/" \
    /opt/scalablebrain/system3/ams/config/.env.system3'
```

**Rotate a VM secret** — edit in place, back it up first, then restart the owning unit:

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp /opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2 \
        /opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2.bak-$TS
sudo -u trader nano /opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2
sudo systemctl restart system2       # ⚠ interrupts live execution — human gate first (§14)
```

**Permissions worth fixing** (report, do not silently change — I-3): `.env.system2` is
world-readable (`0664`) and `gcp-sa.json` is world-**writable** (`0666`). Every other secret
on the box is `0600`. On a single-tenant VM the blast radius is small, but `0666` on a
service-account key means any local process can replace the platform's GCS identity.

### 4.3 System 1 secrets (Computer 1, local)

Held in `.env_system1` at the root of the System 1 tree — and a stale copy sits at the root
of *this* repo. Names **[LIVE]** from that file:

```
DB_SERVER  DB_USER  DB_PASS  DB_PORT
OANDA_API_KEY  OANDA_ACCOUNT_ID_DEMO  OANDA_ACCOUNT_ID  OANDA_ENV  OANDA_URL
SMTP_USER  SMTP_PASS  EMAIL_TO
LAYER3_APPROVAL_THRESHOLD
STORAGE_PROVIDER  STORAGE_LOCAL_ROOT  GCS_BUCKET  GOOGLE_APPLICATION_CREDENTIALS
QUEUE_PROVIDER  QUEUE_LOCAL_ROOT  SCORED_SIGNAL_QUEUE  MAX_QUEUE_SIZE  DLQ_NAME
MLFLOW_TRACKING_URI
```

System 1's GCP key is `scalable-brain/secrets/system1-rw.json` on Computer 1 **[DOC]**.

### 4.4 Local workstation secrets (this repo)

| File | Contents | Git status |
|---|---|---|
| `.env` | Cloud Run credentials — `DATABASE_URL`, `REDIS_URL`, plus some free-text SSH notes. | gitignored |
| `.env_system1` | System 1 credentials, above. | gitignored |
| `cloud/telemetry-web/.env` | `DATABASE_URL`, `REDIS_URL`. **Nothing reads this at runtime** — `main.py` and `services/` resolve config through `os.environ` only, and Cloud Run supplies real values. Excluded from the build context by `.gcloudignore`. | gitignored |
| `link_to_telemetry.md` | Holds a live dashboard access token. | gitignored (EXEC-4, 2026-08-15) |
| `env-vars.yaml` / `*env-vars*.yaml` | `gcloud --env-vars-file` payloads carrying `DATABASE_URL`, `REDIS_URL`, `TELEMETRY_TOKEN` in plaintext. | gitignored after **F-108** |

### 4.5 Secret hygiene rules

1. **`.gcloudignore` is not `.gitignore`.** `gcloud run deploy --source .` uploads the whole
   directory into the Cloud Build staging bucket and bakes it into the image. The repo-root
   `.gitignore` is **not** consulted — gcloud looks for a `.gitignore` in the *deploy
   directory*, and there isn't one. `cloud/telemetry-web/.gcloudignore` is the only thing
   keeping `.env` out of the image. Do not delete or "tidy" it.
2. Never write a secret into `.agents/`, `audit/`, a progress file, a commit message, a PR
   body, or a prompt handed to another agent.
3. When a report needs to prove a secret is set, prove the **name** exists and the service
   started — never the value.

---

## 5. `trading-1` — the trading VM

### 5.1 Instance facts **[LIVE]**

| | |
|---|---|
| Name / zone | `trading-1`, `europe-west1-b`, project `scalable-brain` |
| Machine type | `e2-medium` (2 vCPU / 4 GB) |
| OS | Ubuntu 24.04 LTS, kernel `6.17.0-1021-gcp` |
| Internal IP | `10.132.0.2` |
| External IP | **none** |
| Attached SA | `trading-vm@scalable-brain.iam.gserviceaccount.com` |
| Service user | `trader` |
| Your login user | `emman` (OS Login) |
| Production root | `/opt/scalablebrain` (mode `0777`, owner `trader:trader`) |

### 5.2 Directory layout **[LIVE]**

```
/opt/scalablebrain/
├── system2/system-2-execution-engine/     System 2 — venv at ./venv, PYTHONPATH=src
│   ├── config/.env.system2                broker keys, risk caps
│   ├── config/gcp-sa.json                 GCP key (system1-rw)
│   └── state/                             model-cache, queue, offsets, signals, control
├── system3/ams/                           System 3 — venv at ./.venv
│   ├── config/.env.system3                Telegram + SMTP
│   ├── config/risk_config.json            the risk policy (+ two .bak files)
│   ├── config/holidays.json
│   └── state/db/ams.db                    the AMS SQLite database
├── bridge/                                s2s3_bridge.py, telemetry_publisher.py,
│   │                                      ops_watchdog.py, chat_agent_host.py (DEAD — remove)
│   └── state/equity_history.db
├── shared/queue/queue.db                  ← THE shared queue (S2 + S3 + bridge)
├── backups/                               timestamped deploy backups, each with MD5SUMS.before
├── _deploy_backup_2026072*/               two older migration backups
├── cloud/telemetry-web/                   stale copy — NOT the deploy target
├── telemetry-dashboard/                   stale leftover — DO NOT DEPLOY (see §19.4)
├── deployment-guide/  startup/            stale doc copies
├── .env  .env_system1                     legacy System 1 leftovers, unread
└── s2-postgres.dump                       old Postgres dump
```

### 5.3 The systemd units **[LIVE]**

All unit files are in `/etc/systemd/system/`. All run as `User=trader`.

| Unit | ExecStart | Notes |
|---|---|---|
| `system2` | `…/system-2-execution-engine/venv/bin/python -m system2` | `WorkingDirectory=…/system-2-execution-engine`, `Environment=PYTHONPATH=src`. `ExecStartPre` runs `python -m system2.common.db migrate`. `Requires=postgresql.service`, `After=s2s3-bridge.service`. `Restart=on-failure`, `RestartSec=10`. |
| `s3-ams` | `…/system3/ams/.venv/bin/python -m ams.service.main` | `ExecStartPre` runs `python -m ams.migrate migrate`. |
| `s2s3-bridge` | `…/system3/ams/.venv/bin/python /opt/scalablebrain/bridge/s2s3_bridge.py` | Runs from `/opt/scalablebrain`. Note it uses **System 3's** venv. |
| `s3-signal-relay` | `…/.venv/bin/python scripts/pubsub_signal_relay.py` | Env in the unit: `PUBSUB_PROJECT_ID=scalable-brain`, `RELAY_PUBSUB_SUB=scored_signal_queue_sub`, `RELAY_LOCAL_SUB=scored-signals.ams`, `RELAY_POLL_SLEEP_SEC=5`. `Restart=always`. |
| `telemetry-pub` | `…/system2/…/venv/bin/python /opt/scalablebrain/bridge/telemetry_publisher.py --object ${TELEMETRY_OBJECT}` | `EnvironmentFile=/etc/scalablebrain/telemetry.env`. Uses **System 2's** venv. |
| `s2-downloader` | `…/venv/bin/python -m system2.artifact_sync.downloader` | `Restart=on-failure`, `RestartSec=30`. Separate process from `system2` — starting the engine does **not** start it. |
| `ops-watchdog` | `…/venv/bin/python /opt/scalablebrain/bridge/ops_watchdog.py` | `Type=oneshot`, driven by `ops-watchdog.timer` (~30 min). |

**The unit is `s3-ams`, not `system3-ams`.** That mistake has been made and documented.

### 5.4 Everyday commands

```bash
# Status of everything that matters, including crash-loop detection
for u in system2 s3-ams s2s3-bridge s3-signal-relay telemetry-pub s2-downloader; do
  echo "$u active=$(systemctl is-active $u) enabled=$(systemctl is-enabled $u) NRestarts=$(systemctl show $u -p NRestarts --value)"
done

# Logs
journalctl -u system2 -n 200 --no-pager
journalctl -u s3-ams  --since '30 min ago' --no-pager
journalctl -u system2 -p err --since today --no-pager     # errors only
journalctl -u telemetry-pub -f                            # follow

# Restart (see the gate in §14 before touching system2 or s3-ams)
sudo systemctl restart <unit>
sudo systemctl stop <unit>
sudo systemctl start <unit>

# After editing a unit file
sudo systemctl daemon-reload && sudo systemctl restart <unit>

# Local health
curl -s http://127.0.0.1:8002/health   | python3 -m json.tool
curl -s http://127.0.0.1:8002/status   | python3 -m json.tool
curl -s http://127.0.0.1:8300/health   | python3 -m json.tool
curl -s http://127.0.0.1:8300/state    | python3 -m json.tool
```

### 5.5 Databases on the VM

| Store | Location | Owner |
|---|---|---|
| PostgreSQL 18.4 | `127.0.0.1:5432`, database `system2` | System 2 trade record (`DB_PROVIDER=postgres`, DSN in `.env.system2`) |
| `system3/ams/state/db/ams.db` | SQLite | System 3 — decision log, trade journal, breakers, overrides |
| `shared/queue/queue.db` | SQLite | **the** shared message queue |
| `system2/.../state/queue/queue.db` | SQLite | S2-local queue file |
| `system2/.../state/queue/fill_outbox.db` | SQLite | fill outbox |
| `system2/.../state/offsets/processed.db`, `close_sweep.db` | SQLite | dedup offsets, close-sweep ledger |
| `system2/.../state/signals/signal_ledger.db`, `signal_dedup.db` | SQLite | signal ledger + at-most-once claims |
| `bridge/state/equity_history.db` | SQLite | equity series for the dashboard |

```bash
sudo -u postgres psql -c '\l'                                  # list databases
sudo -u postgres psql -d system2 -c '\dt'                      # tables
sudo -u trader sqlite3 /opt/scalablebrain/system3/ams/state/db/ams.db '.tables'
sudo -u trader sqlite3 /opt/scalablebrain/system3/ams/state/db/ams.db \
  'select signal_id, outcome, rejected_at_layer, approved_units from ams_decision_log order by rowid desc limit 20;'
```

### 5.6 Running Python in the right venv

Every import check, smoke test and signature probe must run in the **service's own venv**,
never system python. That is what caught the `api.py` incident too late.

```bash
# System 2
cd /opt/scalablebrain/system2/system-2-execution-engine
sudo -u trader env PYTHONPATH=src ./venv/bin/python -c "import system2; print('ok')"

# System 3
cd /opt/scalablebrain/system3/ams
sudo -u trader ./.venv/bin/python -c \
  "import inspect; from ams.service.health import build_health; print(sorted(inspect.signature(build_health).parameters))"
```

---

## 6. System 2 — The Hand (execution engine)

### 6.1 Live configuration **[LIVE]**

Non-secret values read from `/opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2`:

| Setting | Value | Meaning |
|---|---|---|
| `EXEC_MODE` | `execution_only` | Executes approved orders; originates nothing. |
| `EXEC_SHADOW` | `false` | **Orders reach the broker.** |
| `OANDA_ENV` | `practice` | Practice account only. |
| `OANDA_PRACTICE_ACCOUNT_ID` | `101-002-38449021-001` | |
| `OANDA_PRACTICE_URL` | `https://api-fxpractice.oanda.com` | |
| `OANDA_LIVE_URL` | `https://api-fxtrade.oanda.com` | Configured, **not selected**. |
| `EXEC_BYPASS_ENABLE` | `false` | The manual bypass path is off. |
| `MAX_OPEN_POSITIONS` | `8` | Runaway ceiling on System 3. |
| `MAX_UNITS_PER_PAIR` | `1000000` | The hard stop that always applies. |
| `MAX_TOTAL_NOTIONAL` | `5000000` | Compared in **account currency** since 2026-08-28. |
| `MAX_LEVERAGE` | `30` | Same. |
| `REQUIRE_STOP_LOSS` | `true` | |
| `TRADEABLE_INSTRUMENTS` | `EUR_USD,GBP_USD,USD_JPY,AUD_USD,USD_CAD` | |
| `QUEUE_PROVIDER` | `local` | |
| `QUEUE_LOCAL_PATH` | `/opt/scalablebrain/shared/queue/queue.db` | Absolute, deliberately. |
| `DB_PROVIDER` | `postgres` | Local Postgres 18.4 on the VM. |
| `STORAGE_PROVIDER` / `GCS_BUCKET` | `gcs` / `scalable-brain-artifacts` | |
| `GOOGLE_APPLICATION_CREDENTIALS` | `config/gcp-sa.json` | Relative to the working directory. |
| `ARTIFACT_ROOT` / `MANIFEST_KEY` | `state/model-cache` / `latest.json` | |
| `HEALTH_PORT` | `8002` | Binds `127.0.0.1`. |
| `STOP_SENTINEL_PATH` | `state/control/STOP` | See §16.2. |

Full key list in `.env.system2`: `ARTIFACT_ROOT`, `BROKER_RETRY_BACKOFF_SEC`,
`BROKER_RETRY_MAX`, `BYPASS_CONFIRM_TOKEN`, `BYPASS_MAX_DURATION_SEC`,
`BYPASS_MAX_POSITIONS`, `BYPASS_RISK_PCT`, `CLOSE_LEDGER_PATH`, `CLOSE_SWEEP_INTERVAL_SEC`,
`DB_DSN`, `DB_PROVIDER`, `DB_RECORD_ENABLED`, `EXEC_BYPASS_ENABLE`, `EXEC_MODE`,
`EXEC_SHADOW`, `EXEC_STOP_FLATTEN`, `FILL_OUTBOX_PATH`, `FILL_PUBLISH_RETRY_MAX`,
`GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`, `HEALTH_ENABLED`, `HEALTH_HOST`,
`HEALTH_PORT`, `INBOUND_QUEUE_NAME`, `MANIFEST_KEY`, `MAX_LEVERAGE`, `MAX_OPEN_POSITIONS`,
`MAX_TOTAL_NOTIONAL`, `MAX_UNITS_PER_PAIR`, `MODEL_POLL_INTERVAL_SEC`,
`MODEL_VERIFY_STRICT`, `OANDA_ENV`, `OANDA_LIVE_ACCOUNT_ID`, `OANDA_LIVE_API_KEY`,
`OANDA_LIVE_URL`, `OANDA_PRACTICE_ACCOUNT_ID`, `OANDA_PRACTICE_API_KEY`,
`OANDA_PRACTICE_URL`, `ORDER_MAX_AGE_SEC`, `OUTBOUND_QUEUE_NAME`, `PROCESSED_STORE_PATH`,
`QUEUE_DLQ_TOPIC`, `QUEUE_LOCAL_EXPECTED_PATH`, `QUEUE_LOCAL_PATH`, `QUEUE_PROVIDER`,
`REQUIRE_STOP_LOSS`, `S3_CLOSE_TOPIC`, `SLIPPAGE_TOLERANCE_PIPS`,
`STALENESS_HYSTERESIS_SEC`, `STALENESS_LIMIT_SEC`, `STOP_SENTINEL_PATH`,
`STORAGE_PROVIDER`, `TRADEABLE_INSTRUMENTS`.

### 6.2 Live status **[LIVE]** 2026-08-31 11:20 UTC

```json
{"exec_mode":"RUNNING","uptime_sec":148225.9,
 "queue":{"staleness_sec":29.1,"staleness_limit_sec":300.0,"messages_seen":0,"last_message_at":null},
 "outbox_depth":0,
 "open_positions":[{"trade_id":"2622","instrument":"GBP_USD"},{"trade_id":"2618","instrument":"EUR_USD"}],
 "model_set_id":"2026-08-24T10-08-20Z-cb697b59_gk-d614163c",
 "broker_env":"practice"}
```

`messages_seen: 0` is the signal drought (§9.3), not a queue fault — `staleness_sec` is
tracking normally.

### 6.3 Key source paths

```
src/system2/execution/lifecycle.py     engine lifecycle, threads, HealthReporter wiring
src/system2/execution/pipeline.py      BackupCorrelationGuard, RiskContext, reanchor_bracket
src/system2/execution/validation.py    notional / leverage ceilings (account-currency)
src/system2/artifact_sync/downloader.py  GCS poll, SHA256 verify, atomic symlink swap
src/system2/artifact_sync/live_regime.py HMM regime detection on live candles
src/system2/common/db.py               migrations  (python -m system2.common.db migrate)
```

### 6.4 Running things by hand

```bash
cd /opt/scalablebrain/system2/system-2-execution-engine
sudo -u trader env PYTHONPATH=src ./venv/bin/python -m system2.common.db migrate
sudo -u trader env PYTHONPATH=src ./venv/bin/python -m pytest -q       # full suite
```

**Local (Windows) test runs** use `venv314`, not `venv` — the VM and the PC use different
venv directory names. Do not copy a path from one to the other.

---

## 7. System 3 — The Guardian (AMS)

### 7.1 Live configuration **[LIVE]**

| Setting | Value |
|---|---|
| `AMS_MODE` | `enforce` |
| `DB_PROVIDER` / `DB_PATH` | `sqlite` / `state/db/ams.db` |
| `QUEUE_PROVIDER` / `QUEUE_LOCAL_PATH` | `local` / `/opt/scalablebrain/shared/queue/queue.db` |
| `QUEUE_MAX_DELIVERY_ATTEMPTS` | `5` |
| `SMTP_HOST` | **empty** — email alerting is disabled |
| `SMTP_PORT` | `587` |

Secret keys present: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SMTP_USER`, `SMTP_PASSWORD`,
`SMTP_TO`. **System 3 never holds the OANDA API key.**

`TELEGRAM_CHAT_ID` is not just a delivery address — it is the **operator allowlist** for
override commands. Anyone who can post to that chat can pause, resume, flatten and reset
breakers.

### 7.2 Live state **[LIVE]** 2026-08-31 11:20 UTC

```json
{"status":"ok","mode":"enforce","state":"RECOVERY",
 "checks":{"db":true,"queue":true,"heartbeat":true},
 "heartbeat_age_sec":24.9,
 "metrics":{"uptime_sec":147709.6,
   "counters":{"messages_consumed":2422,"snapshots_reconciled":2422},
   "rejects_by_layer":{},"decision_latency_ms":{"p50":null,"p95":null,"samples":0}}}
```

```json
{"account_id":"default","mode":"demo","state":"RECOVERY","stage":"paper",
 "balance":84143.79,"equity":83658.31,"peak_equity":88294.53,"drawdown_pct":5.25,
 "open_positions":2,
 "performance":{"window_days":30,"trades":2,"sharpe_30d":0.0,"calmar_30d":-0.987,
   "profit_factor":1775.07,"expectancy_per_trade":74.78,"window_return_pct":-0.436,
   "max_drawdown_pct":0.442,"avg_hold_hours":51.03,
   "avg_slippage_pips":0.1,"max_slippage_pips":0.1}}
```

`state: RECOVERY` and `stage: paper` are the current, expected posture. `decision_latency_ms`
samples are `null` because no decisions have been made in the window — that is honest
absence (I-4), not a broken metric.

### 7.3 Operator control — the CLI

```bash
cd /opt/scalablebrain/system3/ams
sudo -u trader ./.venv/bin/python -m ams.ctl <command> [args] [CONFIRM]
```

Usage string, verbatim from `src/ams/ctl.py`:

```
usage: python -m ams.ctl <command> [args] [CONFIRM]
commands: status | pause | resume CONFIRM | flatten CONFIRM |
          reset_breaker <name> CONFIRM | clear_recovery CONFIRM |
          mode shadow | mode enforce CONFIRM | ack
```

| Command | Effect | Gate |
|---|---|---|
| `status` | Account, breakers, open positions, mode. | none — safe |
| `pause` | Stops the gate approving new orders. | none |
| `resume CONFIRM` | Resumes approvals. | CONFIRM |
| `flatten CONFIRM` | **Closes open positions.** | CONFIRM + I-2: human only |
| `reset_breaker <name> CONFIRM` | Clears a tripped circuit breaker. | CONFIRM + I-3: human only |
| `clear_recovery CONFIRM` | Leaves RECOVERY state. | CONFIRM + human only |
| `mode shadow` | Drops to shadow (logs, publishes nothing). Safe direction. | none |
| `mode enforce CONFIRM` | **Forbidden by I-1** unless already enforce and a human asked. | CONFIRM + human only |
| `ack` | Acknowledges a pending alert. | none |

Every command is parsed by `src/ams/override/commands.py::parse_command` and written to the
override audit trail with the operator id (`ams-cli` for CLI, the Telegram chat id
otherwise), the verbatim raw text, and the result.

### 7.4 Operator control — Telegram

The same commands arrive as `/status`, `/pause`, `/resume CONFIRM`, `/flatten CONFIRM`,
`/reset_breaker <name> CONFIRM`, `/clear_recovery CONFIRM`, `/mode …`, `/ack`, `/stage_up`,
`/unquarantine`. Destructive ones return a **preview** first and require a `CONFIRM` reply.
Only the configured `TELEGRAM_CHAT_ID` is honoured.

Setup, if the bot is ever rebuilt: talk to `@BotFather` → `/newbot` → token; message the bot,
then read `https://api.telegram.org/bot<TOKEN>/getUpdates` and take `message.chat.id`.
Verify with `startup/tools/test_notifications.py`.

### 7.5 Risk policy

`/opt/scalablebrain/system3/ams/config/risk_config.json` (8,629 bytes, last changed
2026-08-29). Two `.bak` copies sit beside it. `config/holidays.json` holds the calendar.

Known live gap, do not "fix" casually: `export.bucket` is `""`, so the strategy-baseline
transport is a no-op. A newly qualified strategy has no prior and every signal rejects with
`insufficient_live_stats` at `src/ams/risk/sizing.py:164` (`live_trades 0 < min_live_trades
20`). **The designed escape is the Bayesian prior (FIX-S3-007)** — seed
`strategy_baseline_cache` deliberately via a CLI path. **Do not lower `min_live_trades`**: a
gate that cannot open is a configuration error, but opening it by dropping the floor puts
full size behind a strategy with zero live evidence.

### 7.6 Known cosmetic noise

`s3-ams` emits two log-formatter tracebacks at every boot
(`ams/common/logging.py:86`, a non-JSON `context`). Present identically at the 08-27 and
08-28 boots. Harmless, inside the logging handler, does not recur after startup. Do not
count these as a failed deploy.

---

## 8. The bridge, publisher, relay and watchdog

### 8.1 `bridge/s2s3_bridge.py` — unit `s2s3-bridge`

Translates System 3 approved orders into System 2's contract and fills back the other way,
over the shared `queue.db`. Runs from `/opt/scalablebrain` using **System 3's** venv.

`translate_order` forwards `entry_price` → `risk_context.proposed_entry`, which is what lets
System 2 re-anchor the bracket (2026-08-28 fix 3).

**Repo/production divergence:** the repo copy is ~176 lines **ahead** with F-406
unrouted-parking tooling (`classify_unrouted`, `message_kind`, `parked_rows`,
`summarize_parked`, `_add_done_at_column`). `translate_order` itself is byte-identical.
Production is "the production file plus the 08-28 change set" — it is **not** the repo file.

There are 14 parked messages on `bridge.unrouted`. They are **evidence for F-406. Do not
drain them.**

### 8.2 `bridge/telemetry_publisher.py` — unit `telemetry-pub`

Polls `127.0.0.1:8002/health` and `127.0.0.1:8300/health`, composes a snapshot, writes it to
GCS. The object is chosen by `TELEMETRY_OBJECT` in `/etc/scalablebrain/telemetry.env`
(`telemetry/latest-vm.json` during dry-run; `telemetry/latest.json` after cutover). Runs in
**System 2's** venv.

Also streams live trades from System 3's `ams.db` `trade_journal` into Cloud SQL
`fact_live_trades` via SQLAlchemy using `DATABASE_URL`, while keeping the GCS snapshot path
alive (dual-mode, Wave 3 M2).

Every ~15 min it checks `gs://…/system1/analytics/latest.json`; on a version change it
downloads, SHA256-verifies, re-uploads the merged copy to `gs://…/telemetry/s1_analytics.json`
and mirrors it to `telemetry-dashboard/public/s1analytics.json` for local dev.

**If the publisher stops, the dashboard shows STALE — it never lies.** That is the designed
behaviour, and it is the reason a blank/STALE panel is a *success* state.

The repo copy is ~322 lines ahead of production with unrelated work.

### 8.3 `system3/ams/scripts/pubsub_signal_relay.py` — unit `s3-signal-relay`

Pulls from Pub/Sub subscription `scored_signal_queue_sub` and writes onto the local queue
subscription name `scored-signals.ams`. **Inbound leg only** — nothing relays outbound.
Config is inline in the unit file, not in a `.env`.

### 8.4 `bridge/ops_watchdog.py` — unit `ops-watchdog` + `.timer`

Oneshot, fired by the timer roughly every 30 minutes. Polls **localhost** `:8002/health` and
`:8300/health` and pages Telegram on "running but not working". Because it depends on
`/health`, a 500 from either service **blinds the watchdog** — which is precisely what the
2026-08-29 `api.py` incident did.

It polls the local services, **not** the Cloud Run dashboard, so a dashboard outage does not
page.

### 8.5 `bridge/chat_agent_host.py` — dead, remove it

Untracked by any repo, so no deploy carries its deletion. Inert only because `claude` is not
installed. It polled a GCS inbox and ran messages through the local `claude` CLI in the
workspace holding the OANDA key and `gcp-sa.json`, with `Bash`/`Write`/`Edit` and
`--permission-mode acceptEdits` when the *message* asked. **F-403.** Delete the file. See
I-8.

`bridge/state/chat_host.log` holds every prompt ever sent, in cleartext, mode `0666`. Delete
it by hand.

---

## 9. System 1 — The Brain

### 9.1 Where it runs

On "Computer 1", a Windows workstation, in a local `scalable-brain/` tree. **It is
intermittent** — power and internet are not guaranteed. Nothing downstream may ever depend
on it being up, and the design honours that: System 3 keeps a local database and has zero
runtime dependency on Computer 1.

| | Value **[DOC]** |
|---|---|
| Database | PostgreSQL 16 + TimescaleDB, `ForexBrainDB` on `localhost:5432` |
| Cloud identity | `system1-rw@scalable-brain.iam.gserviceaccount.com`, key at `scalable-brain/secrets/system1-rw.json` |
| Bucket | `gs://scalable-brain-artifacts` |
| Queue | `QUEUE_PROVIDER=local` — scored signals dead-end into `results/state/queue/` |
| Cron | hourly retrain-trigger; Saturday OANDA ingest |
| Experiment tracking | MLflow, local SQLite backend |

### 9.2 What it publishes

Two independent publishers, both: upload to an immutable versioned prefix → SHA256
round-trip verify → only then atomically flip a `latest.json` pointer. Old versions are never
overwritten.

| Publisher | What | Versioned prefix | Pointer |
|---|---|---|---|
| `src.system1.serializer.serialize` (MODEL-007) | HMM regime model, regime→strategy map, strategy weights, metadata | `system1/<version>/` | `system1/latest.json` |
| `src.system1.serializer.publish_gatekeeper` | XGBoost gatekeeper champion (`champion_model.pkl`, `champion_preprocessor.pkl`, `champion_manifest.json`) | `models/gatekeeper/<version>/` | `models/gatekeeper/latest.json` + `previous.json` |

Version strings are immutable and sortable: `<UTC-timestamp>-<8-hex>`, e.g.
`2026-07-05T17-43-09Z-656f09e2`.

It also publishes an analytics bundle behind `system1/analytics/latest.json` (strategy
catalog + OOS trade returns + frequency stats), and a `strategy_catalog.json` under whatever
`path` that pointer names. The dashboard resolves the catalogue **through the pointer at
request time**, not from a pinned copy — a republished catalogue is picked up without a
redeploy.

Manifest signing: `latest.json.sig` and `system1_manifest_signing_key.pub` sit at the bucket
root.

### 9.3 The live blocker — why nothing is trading

**System 1 has emitted no signal since 2026-08-26T21:15Z.** It runs hourly and reports
`last_run_outcome: "no_signals_generated"`, because its gatekeeper map has **1 tradeable cell
of 15**, and that cell requires the `High-Vol` regime, which vanished from the market on
08-26.

This is upstream of everything on the VM. System 2's `messages_seen: 0` is the *symptom*.
Nothing on `trading-1` will fix it, and nothing on `trading-1` should try.

### 9.4 The deleted signal producer — read before touching this area

On **2026-08-15** the component that produced trading signals was **deleted from
production**, not disabled. It fabricated trade direction from the regime label
(`Trending-Down ⇒ short`) with no entry condition behind it, for 13.4 days and 3,751
signals. Correcting its arithmetic would have produced correctly-signed orders for trades
that had no setup — worse, because it would have looked right.

- `deployment-guide/prompts/EXEC-011-scored-signal-producer.md` is the brief that produced
  the defect. It carries a DO-NOT-EXECUTE header. **It is a provenance record, not a
  design.**
- `deployment-guide/09-LIVE-SIGNAL-PIPELINE.md` is **WITHDRAWN** for the same reason. It
  remains as the record of what ran 2026-07-15 → 2026-08-15 — which is also the window the
  live-vs-backtest comparison covers, and that comparison was measuring two unrelated
  systems.
- Any replacement **translates** entries System 1 has already declared. It does not decide
  direction, entry, stop or target. If an implementation has to *choose* one of those, the
  design is wrong — stop and report. See I-7.

### 9.5 The `ScoredSignal` contract

`system3/ams/contracts/v1/ScoredSignal.schema.json`, JSON Schema draft-07,
`additionalProperties: false`, **flat** (an enveloped message is DLQ'd). Freshness window
15 min on `produced_at`.

| Field | Type | Notes |
|---|---|---|
| `schema_version` | const `"1"` | top level |
| `signal_id` | string (uuid) | the dedup key; S3 enforces uniqueness in the DB |
| `produced_at` | date-time | UTC ISO-8601 |
| `pair` | string | `^[A-Z]{3}_[A-Z]{3}$` |
| `direction` | enum | `long` \| `short` |
| `strategy_id` | **string** | not an int |
| `regime` | string | |
| `model_score` | number | 0–1 |
| `granularity` | enum | `M15` \| `M30` \| `H1` \| `H4` \| `D` |
| `proposed_entry` / `proposed_sl` / `proposed_tp` | number > 0 | |
| `atr` | number > 0 | price units on the signal's granularity |

`system3/ams/src/ams/gate/assemble.py:81-95` shows how S3 consumes these — read it so
producer output and gate expectation cannot drift.

### 9.6 Injecting a test signal

```
system3/ams/scripts/feed_signal.py          end-to-end injection
startup/tools/send_test_signal.py           the other injection path
system3/ams/scripts/shadow_smoke.py         shadow smoke test
audit/loop/test_f1_full_loop.py             the full-loop test
```

---

## 10. OANDA

| | Value |
|---|---|
| Environment in use | **practice** — `OANDA_ENV=practice` **[LIVE]** |
| Practice account | `101-002-38449021-001` **[LIVE]** |
| Practice API base | `https://api-fxpractice.oanda.com` |
| Live API base | `https://api-fxtrade.oanda.com` (configured, **not selected**) |
| Live account | `OANDA_LIVE_ACCOUNT_ID` / `OANDA_LIVE_API_KEY` present in `.env.system2` |
| Account currency | CAD |
| Alias / created | `Primary`, 2026-02-04 |
| Margin rate | `0.02` (50:1) |
| Hedging | disabled |
| Guaranteed SL | DISABLED |

### 10.1 Live account snapshot **[LIVE]** 2026-08-31 11:20 UTC

```
balance            84,143.7905 CAD
NAV / trueNAV      83,748.5249
unrealizedPL        -395.2656
pl / resettablePL -15,804.8279
financing            -51.3816
commission             0.0000
openTradeCount             2      (GBP_USD #2622, EUR_USD #2618)
openPositionCount          2
pendingOrderCount          4
marginUsed          3,357.6821
marginAvailable    80,399.2994
positionValue      67,153.6424
lastTransactionID       2645
```

### 10.2 Who holds the key

**System 2 only.** System 3 has no broker credential by design — the risk gate cannot reach
the broker even if it is compromised. The key lives in `.env.system2` on the VM. System 1
has its own separate `OANDA_API_KEY` on Computer 1 for candle ingest.

To generate a new practice token: log in to the practice account, then
<https://www.oanda.com/demo-account/tpa/personal_token>.

### 10.3 Rules

- **I-2 stands absolutely:** never place, modify or cancel an order by hand.
- Going live is decision **D-004** — pending, human-only, and a separate signed decision. No
  code change, config change, or deploy may perform it.
- Forex closes Friday ~21:00 UTC and reopens Sunday ~21:00 UTC. Prefer that window for any
  restart that interrupts execution.
- Layer H + the weekend gate give a natural no-trade window Wed 18:00Z → Sun 20:00Z for
  migrations.

---

## 11. The Cloud Run dashboard

### 11.1 Service facts **[LIVE]**

| | Value |
|---|---|
| Service | `telemetry-dashboard`, region `europe-west1` |
| Primary URL | `https://telemetry-dashboard-400868689848.europe-west1.run.app` |
| Alternate URL | `https://telemetry-dashboard-q4u3np4twq-ew.a.run.app` |
| Runtime SA | `400868689848-compute@developer.gserviceaccount.com` |
| Ingress | `all` |
| Auth | `--allow-unauthenticated` — protected **only** by `TELEMETRY_TOKEN` |
| Generation | 80 |
| Traffic | `latestRevision: true` @ 100%, plus tag `candidate` → `telemetry-dashboard-00068-4dx` |
| Resources | 1000m CPU, 512Mi, containerConcurrency 80, maxScale 2 (annotation) / 5 (service) |
| Port | 8080 |
| Startup probe | tcpSocket:8080, period 240s, timeout 240s, failureThreshold 1 |
| Cloud SQL attachment | `scalable-brain:europe-west1:telemetry-db` |
| Build image | `europe-west1-docker.pkg.dev/scalable-brain/cloud-run-source-deploy/telemetry-dashboard` |
| Build env | `{"VITE_DATA_MODE":"cloud"}` |
| Last deployed | 2026-08-31T06:24:47Z by `emmanuelebubembachu@gmail.com` |

Env vars: `TELEMETRY_BUCKET=scalable-brain-artifacts`,
`TELEMETRY_OBJECT=telemetry/latest.json`, plus `DATABASE_URL`, `REDIS_URL`,
`TELEMETRY_TOKEN` from Secret Manager.

### 11.2 The deploy target — the single most expensive mistake available

**Deploy `cloud/telemetry-web`. Never `telemetry-dashboard/`.**

`cloud/telemetry-web` is a FastAPI app (`Procfile`: `web: uvicorn main:app --host 0.0.0.0
--port $PORT --workers 1`) doing two jobs at once: serving every `/api/*` route the dashboard
fetches, **and** serving the built front-end from its `static/` directory. The
`telemetry-dashboard/` folder only produces the bundle.

Deploying `telemetry-dashboard/` directly builds a **Node** container running `serve -s
dist`, which answers every unmatched path with `index.html`. `/api/telemetry` goes from
`401 application/json` to `200 text/html`, the dashboard parses HTML as JSON
(`Unexpected token '<', "<!doctype "...`), and **every panel goes blank**. This happened
2026-08-30. Two further revisions were burned "fixing" the container's missing start
command, which only moved further from the real architecture — the working revision needs no
start script because it is not a Node app.

### 11.3 Backend layout

```
cloud/telemetry-web/
├── main.py                     FastAPI app
├── Procfile                    web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
├── .gcloudignore               keeps .env, tests and caches out of the image — do not delete
├── routes/    assets kpi model regimes risk signals streaming strategies trades
├── services/  db_client redis_service layer1_client…layer4_client broker_account
│              trade_service gcs_strategies data_contracts reference_data_client
├── migrations/ 001_initial_schema 002_timescale_continuous_aggregates
│               003_seed_reference_data 004_s1_scored_signals_log + runner.py
└── static/     the built React bundle (from telemetry-dashboard/dist)
```

### 11.4 Endpoints worth knowing

| Endpoint | Notes |
|---|---|
| `/api/telemetry` | The main snapshot. **Verification anchor: must return `401 application/json` unauthenticated.** |
| `/api/analytics` | System 1 analytics bundle (S1-EXPORT-002), 5 min cache. |
| `/api/strategy-catalog` | Pointer-resolved at request time, 5 min cache. Returns `{pointer, catalog}`. Deliberately does **not** read `telemetry/s1_analytics.json` — that mirror lagged System 1 by a day on 2026-08-23, and a stale catalogue still looks current. Overrides: `TELEMETRY_S1_ANALYTICS_POINTER`, `TELEMETRY_S1_CATALOG_NAME`, `TELEMETRY_S1_CATALOG_CACHE_SEC`. |
| `/api/v1/signals/gate1-mix` | Withholds the shadow refusal rate until `GATE1_SHADOW_MIN_N` (default **30**) verdict-bearing rows exist. Below that: `refusal_rate: null`, never `0.0`. At ~1–2 H4 signals/day that takes 2–3 weeks. Lower it deliberately with `--set-env-vars GATE1_SHADOW_MIN_N=<n>` and record why — do not remove the guard. |
| `/health` | The real one. Reports the actual DB backend and connection state; returns **503** when degraded. **Point monitoring here.** |
| `/livez` | Trivial liveness, `{"ok": true}`. |
| `/healthz` | **Never use.** Google's frontend intercepts `/healthz` on Cloud Run and answers with its own HTML 404 before the request reaches the container — verified 2026-08-31. A handler at that path works locally and is dead in production. |
| `/api/chat/*` | **Deleted 2026-08-01 (F-403). Do not rebuild.** `cloud/telemetry-web/test_no_chat_relay.py` asserts *absence*, so a "safely disabled" relay still fails it. |

### 11.5 Accessing the dashboard

Open the URL with `?token=<TELEMETRY_TOKEN>` once per browser; it is remembered.

```bash
TOKEN=$(gcloud secrets versions access latest --secret=telemetry-token --project=scalable-brain)
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://telemetry-dashboard-400868689848.europe-west1.run.app/api/telemetry
# expect: 401 application/json

curl -s -H "Authorization: Bearer $TOKEN" \
  https://telemetry-dashboard-400868689848.europe-west1.run.app/api/telemetry | head -c 400
```

### 11.6 Open security item

The service is `--allow-unauthenticated` with ingress `all`, so a read-only dashboard
carrying live account figures is protected by one shared static token. **Recommended, not
done:** drop the `allUsers` `roles/run.invoker` binding and put the service behind IAP or
Cloud Run IAM. Parked under decision **D-006**. Report it; do not unilaterally change it —
locking it wrong locks the owner out.

---

## 12. The cloud data plane

### 12.1 GCS buckets **[LIVE]**

| Bucket | Purpose |
|---|---|
| `scalable-brain-artifacts` | **The** bucket. Models, telemetry, contracts, risk reference, handoff, backups. |
| `system2-scalable-brain` | Per-system bucket. |
| `system3-scalable-brain` | Per-system bucket. |
| `run-sources-scalable-brain-europe-west1` | Cloud Build source staging for `--source` deploys. |

`gs://scalable-brain-artifacts/` top level **[LIVE]**:

```
README.md
latest.json                       System 2 downloader's manifest key (MANIFEST_KEY)
latest.json.sig                   manifest signature
system1_manifest_signing_key.pub  verification key
previous_model_set.json           rollback breadcrumb
backups/    contracts/    handoff/    models/    risk/    system1/    telemetry/
```

Key objects:

| Object | Consumer |
|---|---|
| `latest.json` | System 2 `artifact_sync.downloader` — polls every `MODEL_POLL_INTERVAL_SEC` (900 s), downloads each listed artifact, verifies SHA256 per file, atomically swaps `ARTIFACT_ROOT/active → sets/<model_set_id>`, keeps `last_good`. Checksum mismatch or GCS outage ⇒ keeps serving last-known-good, never blocks. |
| `models/gatekeeper/latest.json` (+ `previous.json`) | Gatekeeper champion pointer. |
| `system1/latest.json` | Current model-set pointer. |
| `system1/analytics/latest.json` | Analytics + strategy-catalogue pointer. |
| `telemetry/latest.json` | Dashboard's snapshot source. |
| `telemetry/latest-vm.json` | VM publisher's dry-run object. |
| `telemetry/s1_analytics.json` | Publisher's merged mirror behind `/api/analytics`. |
| `telemetry/history/day/*.json` | Legacy daily trade history, ingested by `scripts/wave3_gcs_to_postgres.py`. |
| `risk/strategy_stats/latest.json`, `risk/holiday_calendar.json`, `risk/macro_windows/…` | System 3 reference data. **Nothing publishes `risk/` yet** — S3 is designed to survive its absence. |
| `ams/journal-exports/…` | Written by System 3, ingested by System 1 when Computer 1 is online. |
| `chat/` | May still hold queued inbox/outbox messages from the deleted relay. No code reads them. Deleting the prefix is a cloud-data action — owner's call. |

```bash
gcloud storage ls gs://scalable-brain-artifacts/
gcloud storage cat gs://scalable-brain-artifacts/latest.json
gcloud storage cat gs://scalable-brain-artifacts/models/gatekeeper/latest.json
gcloud storage cat gs://scalable-brain-artifacts/telemetry/latest.json | head -c 2000
gcloud storage cp gs://scalable-brain-artifacts/telemetry/latest-vm.json .
```

**Live state is readable without VM credentials** at
`gs://scalable-brain-artifacts/telemetry/latest-vm.json`, republished every ~30 s. Use it
before reaching for SSH.

**`gsutil` is broken on this workstation.** Always `gcloud storage`.

### 12.2 Pub/Sub — the live names, which are not the documented names **[LIVE]**

| Topics | Subscriptions |
|---|---|
| `scored_signal_queue` | `scored_signal_queue_sub` |
| `scored_signal_dlq` | `scored_signal_dlq_sub` |
| `scored_signal_heartbeat` | `scored_signal_heartbeat_sub` |
| `AMS_Outbound_Queue` | `AMS_Outbound_Queue_sub` |
| `AMS_Inbound_Queue` | `AMS_Inbound_Queue_sub` |

> **[DOC vs LIVE]** `01-GCP-SETUP.md` and `05-QUEUES-AND-CONTRACTS.md` describe
> `scored-signals` / `ams-outbound` / `ams-inbound` with `.ams` / `.executor` / `.dlq`
> suffixes. **Those names do not exist.** Only `s3-signal-relay` uses Pub/Sub at all
> (`scored_signal_queue_sub`); the actual S2↔S3 path is the local SQLite queue. Write
> against the live names.

```bash
gcloud pubsub topics list --project scalable-brain
gcloud pubsub subscriptions list --project scalable-brain
gcloud pubsub subscriptions describe scored_signal_queue_sub --project scalable-brain
gcloud pubsub subscriptions pull scored_signal_dlq_sub --limit 5 --project scalable-brain   # NO --auto-ack
```

Never `--auto-ack` a DLQ you are inspecting: acking destroys the evidence.

### 12.3 Cloud SQL **[LIVE]**

| | |
|---|---|
| Instance | `telemetry-db` |
| Version | POSTGRES_15 |
| Tier / location | `db-f1-micro`, `europe-west1-b` |
| Public IP | `34.52.232.110` |
| Database | `scalable_brain` |
| Connection name | `scalable-brain:europe-west1:telemetry-db` |
| Reached by | Cloud Run (`cloudsql-instances` annotation) and the VM publisher via `DATABASE_URL` |

Dimensional model: `dim_asset`, `dim_strategy`, `fact_live_trades`; views
`daily_trade_summary`, `hourly_trade_summary`, `regime_performance_summary`.

```bash
gcloud sql instances describe telemetry-db --project scalable-brain
gcloud sql operations list --instance telemetry-db --project scalable-brain --limit 10
DB=$(gcloud secrets versions access latest --secret=telemetry-database-url --project=scalable-brain)
psql "$DB" -c 'select count(*) from fact_live_trades;'
```

Migrations: `cloud/telemetry-web/migrations/` — `001_initial_schema.sql`,
`002_timescale_continuous_aggregates.sql`, `003_seed_reference_data.sql`,
`004_s1_scored_signals_log.sql`, driven by `migrations/runner.py`.

Equity calibration (Wave 3): `base_balance = 87,706.74`; `accountBalance = base_balance +
sum(Net_PnL)` ⇒ `84,013.70` with cumulative Net PnL `-3,693.04`. Lives in
`services/layer4_client.py`. **This is a calibration constant, not a measurement** — if the
account's true history changes, it must be re-derived, not nudged.

Ingestion is idempotent: `INSERT … ON CONFLICT (order_id) DO UPDATE`.

### 12.4 Redis

Upstash, external. Only Cloud Run holds `REDIS_URL`. Used by `services/redis_service.py` for
caching. Rotate via Secret Manager (§4.1).

### 12.5 Cost notes

Cloud Run scales to zero at 256Mi–512Mi — inside the free tier for a single viewer. GCS at a
5 s publish cadence is ~17k writes/day ≈ $2–3/month; widen `--interval-sec` on the publisher
to cut it. The VM at `e2-medium` is ~$27/mo; `e2-small` would be ~$13/mo if headroom allows.

---

## 13. Local development (Windows workstation)

### 13.1 Repo layout

```
scalablebrain/
├── .agents/               agent session workspaces (briefings, dispatches, progress)
├── audit/                 findings F-1xx…F-6xx, harness, ledger, loop tests, visuals
│   └── state/             DELIBERATELY TRACKED — audit ledger + orchestrator checkpoint
├── cloud/telemetry-web/   ← the Cloud Run deploy target
├── cloud/signal-ingester/ Dockerfile + ingest.py + fixtures
├── deployment-guide/      docs, templates, runbooks, measure specs, prompts
├── docs/                  design docs, test specs, executive reports
├── provenance/            VM capture snapshots (2026-07-31) — production evidence
├── scripts/               wave3_gcs_to_postgres.py, verify_live_cloud_run.py,
│                          verify_challenger_empirical.py, capture_first_order.py
├── shared/notforyou/layer5/  canonical layer5 dashboard source
├── startup/               Windows .bat launchers + tools/
├── telemetry-dashboard/   React/Vite front-end (bundle source only)
├── tests/                 Python e2e suite
├── system2/  system3/  bridge/     ← NESTED GIT REPOS, read-only mirrors
└── CLAUDE.md  PROJECT.md  README.md
```

`system2/`, `system3/` and `bridge/` are **nested git repositories** and are gitignored by
the parent. They are read-only mirrors of what runs on the VM — and, per §14, not even
reliable mirrors.

### 13.2 Launching locally

```bat
startup\setup.bat          REM first time only — installs deps for all components
startup\start_all.bat      REM System 3, bridge, System 2, dashboard, publisher
startup\start_both.bat     REM S2 + S3 + bridge only
```

`start_all.bat` preflights before launching anything: it requires
`system2\system-2-execution-engine\venv314\Scripts\activate.bat`,
`system2\...\config\.env.system2`, `system3\ams\.venv\Scripts\activate.bat`,
`system3\ams\config\.env.system3`, and `bridge\s2s3_bridge.py`. If any is missing it prints
the errors and starts nothing.

Note the venv names differ from the VM: **`venv314` locally, `venv` on the VM** for System 2;
`.venv` in both places for System 3.

Where to look after launch:

```
System 3 state:   http://127.0.0.1:8300/state
System 2 status:  http://127.0.0.1:8002/status
Dashboard local:  see the npm window for its URL
Dashboard web:    https://telemetry-dashboard-400868689848.europe-west1.run.app
```

Demo notes: if S3 boots PAUSED on a fresh DB, run `.venv\Scripts\python -m ams.ctl resume
CONFIRM` in `system3\ams`; seed sizing priors once with `python tools\seed_demo_stats.py`.
Full walkthrough in `startup/DEMO_RUNBOOK.md`.

The 6th window used to be the Chat Agent Host. It is gone (F-403) and must not come back.

### 13.3 Local backend dev

```bash
cd cloud/telemetry-web
pip install -r requirements.txt
uvicorn main:app --reload
```

### 13.4 Front-end build

```bash
cd telemetry-dashboard
npm install
npm run dev                              # local dev server
VITE_DATA_MODE=cloud npm run build       # cloud mode is MANDATORY for a deploy
```

`vite.config.js` carries a `strip-local-mirrors` plugin that removes `public/strategy.json`,
`public/s1analytics.json`, `public/strategy-catalog.json` and `public/s1health.json` from
cloud builds. **Those files must never ship in `static/`** — they would bypass the token.

`dist/` is gitignored, so built assets are not tracked. **The deployed revision is the record
of what shipped.**

### 13.5 Repo hygiene facts

- The **deployed dashboard app is `App.tsx`**, not what `telemetry-dashboard/CONNECTIONS.md`
  describes. That doc describes an app that is not mounted.
- `audit/state/` is tracked on purpose even though `**/state/` is otherwise gitignored — the
  credit-limit resume protocol depends on the orchestrator checkpoint.
- The architecture hub is a **separate repo**, JS-rendered, with no local checkout. Clone it
  and edit `data/goals.json`.

---

## 14. Deploying to `trading-1` — the canonical procedure

There is no deploy script. Deploys are hand-copied files. Follow all seven steps.

### Step 0 — human gate

Restarting `system2` or `s3-ams` **interrupts live execution.** Get explicit human approval
and prefer a market-closed window (forex closes Friday ~21:00 UTC; Layer H + weekend gate
gives Wed 18:00Z → Sun 20:00Z).

### Step 1 — diff against production, both directions

```bash
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain --tunnel-through-iap --quiet \
  --command='cat /opt/scalablebrain/<path>' > /tmp/prod_file.py
diff /tmp/prod_file.py <repo path>
```

Separate **your** change from pre-existing divergence by diffing production against the last
commit *before* your work:

```bash
git -C <nested repo> show HEAD~1:<relative path> | diff - /tmp/prod_file.py
```

If that diff is non-empty, the file carries unrelated repo-ahead work. **Do not copy it
wholesale.** Splice your change onto the production file, or reconcile the divergence first
as its own piece of work.

Measured divergence as of 2026-08-29:

| File | Relationship to production |
|---|---|
| `system3/ams/src/ams/service/api.py` | was **identical** before the telemetry change |
| `system2/.../execution/lifecycle.py` | repo **ahead** — F-309 `resolve_shadow` + a `HealthReporter(shadow_fn=…)` signature production does not have |
| `bridge/telemetry_publisher.py` | repo **ahead by ~322 lines** of unrelated work |
| `bridge/s2s3_bridge.py` | repo **ahead ~176 lines** (F-406 tooling); `translate_order` byte-identical |
| `bridge/ops_watchdog.py` | **production is ahead of the repo** — it already has the `removed` handling |
| `system3/ams/` | repo has uncommitted changes to `service/main.py`, `consumers.py`, `contracts.py`, `api.py`, `health.py` |

There is no safe general rule and neither side is globally newer. **Diff before every copy,
in both directions.**

### Step 2 — check the collaborators

For every attribute, method, kwarg or import your change touches, confirm production has it
— **in the service's own venv**:

```bash
cd /opt/scalablebrain/system3/ams
sudo -u trader ./.venv/bin/python -c \
  "import inspect; from ams.service.health import build_health; print(sorted(inspect.signature(build_health).parameters))"
```

A file can be in sync while its collaborators are not. That is what caused both production
incidents.

### Step 3 — back up, with checksums

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ); BK=/opt/scalablebrain/backups/<name>-$TS
sudo mkdir -p "$BK"
sudo cp <prod file> "$BK/"
(cd "$BK" && sudo md5sum * | sudo tee MD5SUMS.before)
```

### Step 4 — syntax-check the incoming file on the VM

```bash
python3 -c "import ast; ast.parse(open('/tmp/incoming.py').read())"
```

Use `ast.parse`, **not** `py_compile` — the latter fails on `__pycache__` permissions as a
non-`trader` user. And `ast.parse` passing is not "it works": duplicate function definitions
are legal Python and the later one silently wins. Also run §17.4.

### Step 5 — install and restart

```bash
sudo install -o trader -g trader -m 644 /tmp/incoming.py <prod path>
sudo systemctl restart <units>
```

Ownership `trader:trader`, mode `644`. Units: `system2`, `s3-ams`, `s2s3-bridge`,
`s3-signal-relay`, `telemetry-pub` — it is **`s3-ams`**, not `system3-ams`.

### Step 6 — verify behaviour, not liveness

```bash
for u in system2 s3-ams s2s3-bridge s3-signal-relay telemetry-pub; do
  echo "$u $(systemctl is-active $u) NRestarts=$(systemctl show $u -p NRestarts --value)"
done
```

`NRestarts` must be **0** — `active` alone does not rule out a crash loop. Then prove the
actual change: call the endpoint and compare it to the source of truth (a SQL query, the
broker, the file). **"I restarted the service" is not evidence. "I called the endpoint and
got 4,097, matching the SQL count" is.**

### Step 7 — rollback if anything is wrong

```bash
BK=/opt/scalablebrain/backups/<name>-<timestamp>    # MD5SUMS.before is inside
sudo install -o trader -g trader -m 644 "$BK/<file>" <prod path>
sudo systemctl restart <units>
```

Existing backup sets on the VM **[LIVE]**: `fix-blockers-20260828T170101Z`,
`telemetry-20260829T181200Z`, `telemetry-pub-20260829T190815Z`,
`watchdog-20260829T191102Z`, `layer-h-split-20260829T011035Z`,
`session-align-20260829T012653Z`, `drill-20260829T085321Z`,
`exec-shadow-20260823T120230Z`, `feat-20260823T004404Z`, `map-20260823T005110Z`,
`p0-20260823T001605Z`, `bogus-queue-recovered`.

---

## 15. Deploying the dashboard — the canonical procedure

### 15.1 The four commands

```bash
cd telemetry-dashboard && VITE_DATA_MODE=cloud npm run build   # cloud mode is mandatory
rm -f ../cloud/telemetry-web/static/assets/*                   # drop the stale hashed assets
cp -r dist/* ../cloud/telemetry-web/static/
cd ../cloud/telemetry-web && gcloud run deploy telemetry-dashboard \
  --source . --region europe-west1 --allow-unauthenticated --project scalable-brain
```

Windows equivalent for the copy step: `robocopy dist ..\cloud\telemetry-web\static /MIR`.

Env vars persist across redeploys. Only pass `--set-env-vars` / `--update-secrets` when you
actually intend to change them.

Deleting the stale hashed assets matters: `cp -r` leaves old `index-<hash>.js` files behind,
the image grows, and a cached HTML file can reference a bundle you thought you replaced.

### 15.2 Verify the deploy actually went live

The deploy output is **not** evidence. On 2026-08-31 traffic was pinned to a fixed revision:
deploys created a new revision, it went ready, took zero traffic and was retired minutes
later, while the live site kept serving the previous day's bundle. `gcloud run deploy`
printed:

> Service [telemetry-dashboard] revision [telemetry-dashboard-00068-4dx] has been deployed
> and is serving 100 percent of traffic.

That is the **old** revision's traffic share. The command reports success while shipping
nothing, and names a revision you did not just build.

Traffic is currently back on `--to-latest` **[LIVE]**, so deploys promote themselves. If
anyone pins it again it stays pinned until explicitly reset.

**Two checks, both required:**

```bash
# 1. The backend still exists — must be 401 application/json, NOT 200 text/html
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://telemetry-dashboard-400868689848.europe-west1.run.app/api/telemetry

# 2. The bundle actually changed — compare the hash the build printed
curl -s https://telemetry-dashboard-400868689848.europe-west1.run.app/ \
  | grep -o 'assets/index-[^"]*\.js'
```

If the hashes differ from what `npm run build` printed, the deploy did not go live:

```bash
gcloud run services update-traffic telemetry-dashboard \
  --region europe-west1 --project scalable-brain --to-latest
```

### 15.3 Test a revision before promoting

```bash
gcloud run deploy telemetry-dashboard --source . --region europe-west1 --no-traffic \
  --tag candidate --project scalable-brain
# test the tagged URL, then:
gcloud run services update-traffic telemetry-dashboard --region europe-west1 \
  --project scalable-brain --to-revisions <new-revision>=100
```

A `candidate` tag currently points at `telemetry-dashboard-00068-4dx` **[LIVE]**.

### 15.4 Rollback

```bash
gcloud run revisions list --service telemetry-dashboard --region europe-west1 --project scalable-brain
gcloud run services update-traffic telemetry-dashboard --region europe-west1 \
  --project scalable-brain --to-revisions <last-good>=100
```

**Traffic does not move automatically after a rollback pins it.** The next
`gcloud run deploy` will report the new revision serving **0 percent**. Promote it with
`update-traffic --to-revisions <new>=100`, or reset with `--to-latest`, once verified.

### 15.5 Useful service commands

```bash
gcloud run services describe telemetry-dashboard --region europe-west1 --format=yaml
gcloud run revisions list --service telemetry-dashboard --region europe-west1
gcloud run services logs read telemetry-dashboard --region europe-west1 --limit 100
gcloud run services logs tail telemetry-dashboard --region europe-west1
gcloud builds list --limit 5 --project scalable-brain
```

---

## 16. Emergency controls — how to stop things

Ordered least to most invasive. **I-3 stands: report, do not auto-remediate.** These are
documented so a human can act fast, and so an agent knows exactly what it must not do alone.

### 16.1 Pause the risk gate (stops new orders, leaves positions open)

```bash
cd /opt/scalablebrain/system3/ams
sudo -u trader ./.venv/bin/python -m ams.ctl pause
```

### 16.2 System 2 stop sentinel

`STOP_SENTINEL_PATH=state/control/STOP` (relative to
`/opt/scalablebrain/system2/system-2-execution-engine`). Creating that file trips the
EXEC-010 emergency stop. `EXEC_STOP_FLATTEN` controls whether the stop also flattens.
**Check its value before creating the sentinel** — flattening is a broker action and falls
under I-2.

### 16.3 Stop services

```bash
sudo systemctl stop system2          # stops execution; S3 keeps gating into the queue
sudo systemctl stop s3-ams           # stops the gate
sudo systemctl stop s2s3-bridge telemetry-pub s3-signal-relay s2-downloader
```

Stopping `telemetry-pub` makes the dashboard go **STALE**, which is correct behaviour, not a
failure.

### 16.4 Flatten positions — human only

```bash
sudo -u trader ./.venv/bin/python -m ams.ctl flatten CONFIRM
```

Closes open positions through the broker. **I-2: never run this as an agent.** It prints a
preview before the CONFIRM.

### 16.5 Reset a circuit breaker — human only

```bash
sudo -u trader ./.venv/bin/python -m ams.ctl reset_breaker <name> CONFIRM
```

The account has been `CIRCUIT_BROKEN` before. Resetting is a **logged decision**
(`src/ams/override/commands.py:308`), not a cleanup step. Do not reset it, and do not write
code that resets it.

### 16.6 Stop the dashboard

```bash
gcloud run services update telemetry-dashboard --region europe-west1 --project scalable-brain --min-instances=0
gcloud run services delete telemetry-dashboard --region europe-west1 --project scalable-brain   # nuclear
```

### 16.7 Stop the VM

```bash
gcloud compute instances stop trading-1 --zone europe-west1-b --project scalable-brain
gcloud compute instances start trading-1 --zone europe-west1-b --project scalable-brain
```

Stopping the VM with open positions leaves them unmanaged at the broker. Stops and takes
still execute at OANDA, but nothing reconciles them until the VM returns.

---

## 17. Verification catalogue

Each check names the expected value. A check without an expected value is not a check.

### 17.1 Whole-stack, one command

```bash
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain --tunnel-through-iap --quiet --command='
for u in system2 s3-ams s2s3-bridge s3-signal-relay telemetry-pub s2-downloader; do
  echo "$u active=$(systemctl is-active $u) NRestarts=$(systemctl show $u -p NRestarts --value)"
done
echo "--- S2 ---"; curl -s --max-time 10 http://127.0.0.1:8002/health
echo; echo "--- S3 ---"; curl -s --max-time 10 http://127.0.0.1:8300/health'
```

Expected: six units `active`, every `NRestarts=0`; S2 `{"status":"ok",…}`; S3
`{"status":"ok","mode":"enforce","checks":{"db":true,"queue":true,"heartbeat":true}}` with
`heartbeat_age_sec` well under the staleness limit.

### 17.2 Dashboard

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://telemetry-dashboard-400868689848.europe-west1.run.app/api/telemetry
```

Expected: `401 application/json`. **`200 text/html` means the backend is gone** — the wrong
folder was deployed (§11.2). Also check `/health` returns 200 (503 = degraded) and `/livez`
returns `{"ok": true}`. Never probe `/healthz`.

### 17.3 Snapshot freshness without SSH

```bash
gcloud storage cat gs://scalable-brain-artifacts/telemetry/latest-vm.json | head -c 600
```

Expected: an `as_of` timestamp within ~60 s of now. Older means the publisher is down and the
dashboard is correctly showing STALE.

### 17.4 After any structural Python edit

```bash
python3 -c "import ast; ast.parse(open('f.py').read())"          # must not raise
grep -oE '^def [a-zA-Z0-9_]+' f.py | sort | uniq -d              # must print NOTHING
```

Then import the module **in the service's own venv** (§5.6). Duplicate defs are legal Python
and the later one silently wins — `ast.parse` will not catch that.

### 17.5 Test suites

```bash
# System 2 — expect 355 passed (execution subset 187/187) as of 2026-08-28
cd /opt/scalablebrain/system2/system-2-execution-engine
sudo -u trader env PYTHONPATH=src ./venv/bin/python -m pytest -q

# System 3 — expect 637 passed, 1 failed.
# The known failure is test_live_boot_wires_real_handlers (asserts 2 consumers, finds 3):
# PRE-EXISTING, from uncommitted working-tree changes to service/main.py. Confirmed by
# stashing and re-running. Do not "fix" it as part of an unrelated change.
cd /opt/scalablebrain/system3/ams
sudo -u trader ./.venv/bin/python -m pytest -q
```

### 17.6 Repo-side verification scripts

```
scripts/verify_live_cloud_run.py          checks the deployed service end to end
scripts/verify_challenger_empirical.py    challenger verification
scripts/capture_first_order.py            order capture
scripts/wave3_gcs_to_postgres.py          GCS → Cloud SQL ingestion (idempotent upsert)
audit/loop/test_f1_full_loop.py           full-loop test — a failure here is a FINDING
```

### 17.7 What counts as evidence

| Not evidence | Evidence |
|---|---|
| "Restarted the service" | "Called `/api/telemetry` and got 401 application/json" |
| "`systemctl is-active` says active" | "`NRestarts=0` after 10 minutes and the endpoint returns the new field" |
| "Tests pass locally" | "Tests pass in the service's own venv on the VM" |
| "`ast.parse` succeeded" | "`ast.parse` succeeded, no duplicate defs, module imports in the venv" |
| "The deploy printed 100 percent of traffic" | "The live page references the `index-<hash>.js` the build just produced" |
| "The panel shows a number" | "The panel's number equals the SQL count" |

Where a bug is already visible in live data, name it as a required test fixture: *"the
reconciliation MUST report the EUR_USD and GBP_USD stop-loss divergence; if it reports clean,
it is broken."*

---

## 18. Writing prompts for agents on this codebase

From `CLAUDE.md`, because every one of these is a real failure that a more precise prompt
would have prevented.

1. **Say which copy of the file to edit, and how it reaches production.** Name the repo path,
   name the production path, and state that editing one does not change the other.
2. **Demand evidence, and say what counts.** Write the acceptance check into the prompt as a
   command with an expected value.
3. **Forbid regex/script-based patching.** An agent patched `lifecycle.py` with a `re`-based
   script: it deleted three real keyword arguments, invented six that do not exist, left a
   dangling `), consumer.lag.last_message_at),` and produced a file that would not parse.
4. **Say that `ast.parse` passing is not "it works".** Require the duplicate-def check and a
   venv import.
5. **Say a file can be in sync while its collaborators are not.** Both production incidents
   came from this.
6. **Scope by owning system so two agents never edit one file.** Dashboard / System 2 +
   `bridge/` / System 3 + publisher. Where two agents need the same data, freeze the payload
   shape in both prompts as a contract so they can work in parallel.
7. **Name what is out of scope**, explicitly.
8. **State the standing invariants every time** (§1).
9. **Say what "honest" means here** (I-4).
10. **Give them the real numbers.** Prompts carrying live evidence — row counts, actual
    endpoint responses, `file:line` — produced far better work than prompts pointing at
    documentation. This repo's docs are known-stale in places.

---

## 19. Known traps — the incident graveyard

**19.1 — Editing the repo and calling it a deploy.** 2026-08-29: an agent implemented seven
System 3 endpoints, edited the repo, restarted `s3-ams` and `telemetry-pub`, reported
success. All seven still returned 404. The restart interrupted the live gate for no benefit.

**19.2 — Copying a file whose collaborators diverged.** 2026-08-28: `lifecycle.py` copied
wholesale passed `shadow_fn=` to a `HealthReporter` that production does not accept. System 2
crash-looped ~2 minutes with `TypeError: HealthReporter.__init__() got an unexpected keyword
argument 'shadow_fn'`.

**19.3 — A file in sync whose *callee* was not.** 2026-08-29: `api.py` was byte-identical to
production and syntax-clean, but called `source.producer_liveness()`. Production's `Service`
has no such method and its `build_health` takes only `{account_state, db_ok,
heartbeat_age_sec, metrics, mode, queue_ok}`. `/health` returned 500 — which also blinded the
ops watchdog's Guardian heartbeat check. Rolled back in under a minute.

**19.4 — Deploying `telemetry-dashboard/` instead of `cloud/telemetry-web`.** 2026-08-30.
Built a Node container running `serve -s dist`; `/api/telemetry` went from `401
application/json` to `200 text/html`; every panel blank. Two further revisions burned
"fixing" a missing start command that the correct architecture does not need.

**19.5 — Pinned traffic reporting a successful deploy that shipped nothing.** 2026-08-31.
§15.2.

**19.6 — `/healthz` intercepted by Google's frontend.** Works locally, dead in production.
Verified 2026-08-31: every other unknown path returns our SPA or our JSON 404 carrying
`Server: Google Frontend`; `/healthz` returns Google's error page with no such header.

**19.7 — Two systems on two never-connected queues.** Relative queue paths resolved from each
service's own working directory. Both now use the absolute
`/opt/scalablebrain/shared/queue/queue.db`.

**19.8 — Secrets baked into a Cloud Build image.** `.gcloudignore` is the only guard, and the
repo-root `.gitignore` is not consulted. F-108 also put a plaintext `env-vars.yaml` into the
repo.

**19.9 — Remote code execution beside the broker key.** F-403, the chat agent host. Deleted
from source; residue remains on the VM (§8.5). I-8.

**19.10 — A signal producer that invented direction.** 3,751 fabricated signals over 13.4
days. §9.4. I-7.

**19.11 — A regex patch that mangled a source file.** §18.3.

**19.12 — Scope creep dropping an otherwise good change.** §18 item 7 / I-12.

**19.13 — Currency-blind risk ceilings.** `units * entry_price` is denominated in the pair's
*quote* currency, so one scalar cap compared unlike quantities: a USD_JPY order of ~80,240
CAD measured as 9.23M *yen*. JPY pairs were ~110× more likely to trip it, and anything above
~31k units was structurally unreachable. Fixed 2026-08-28 by converting base→account
currency; when no cross is quotable the notional/leverage ceilings are **skipped** rather
than applied to a number in the wrong currency, and `max_units_per_pair` remains the hard
stop.

**19.14 — Applying absolute bracket levels to a different entry.** System 1's bracket is
anchored to `proposed_entry`, a *setup level*, not a spot quote. System 2 fills at market.
The loud symptom was the 08-26 GBP_USD reject (73-pip drift vs a 64-pip stop). **The silent
one**: the 08-24 fills ran stops ~32% tighter than the distance System 3 sized against
(EUR_USD 151.9 → 103.0 pips; GBP_USD 163.1 → 112.8). Fixed by preserving *distances*, not
*levels*; `ENTRY_DRIFT_MAX_SL_MULT` (default 2.0) still refuses a setup whose entry drifted
past 2× its own stop distance.

**19.15 — A gate that cannot open.** A newly qualified strategy has no baseline, so every
signal rejects `insufficient_live_stats` with services up and heartbeats beating. Silent by
construction until `prior_available` is surfaced. §7.5.

---

## 20. Corrections — where the existing docs are wrong

| Document | Says | Actually **[LIVE]** |
|---|---|---|
| `01-GCP-SETUP.md` | Create `system2-exec@…` and `system3-ams@…` | Neither exists. Real SAs: `system1-rw`, `trading-vm`, `system2-ro`, default compute. |
| `01-GCP-SETUP.md`, `05-QUEUES-AND-CONTRACTS.md` | Topics `scored-signals`, `ams-outbound`, `ams-inbound` with `.ams`/`.executor`/`.dlq` subs | Real: `scored_signal_queue`, `scored_signal_dlq`, `scored_signal_heartbeat`, `AMS_Outbound_Queue`, `AMS_Inbound_Queue`, each with a `_sub`. |
| `00-CURRENT-STATE.md` (2026-07-10) | System 3 is "NOT STARTED — zero code exists"; System 2 "CODE COMPLETE, NOT PROVISIONED"; no Pub/Sub topics | Both are deployed and running on `trading-1`; five Pub/Sub topics exist. This file is superseded. |
| `00-CURRENT-STATE.md` | System 2 starts in `execution_only` + SHADOW | `EXEC_SHADOW=false`. Orders reach the broker (practice). |
| `04-SYSTEM3-SETUP.md` (implied) | System 3 on local Postgres, `ams_db` | `DB_PROVIDER=sqlite`, `state/db/ams.db`. The VM's Postgres 18.4 hosts database `system2`. |
| Earlier `DEPLOY-2026-08-28` draft | `ssh eem@100.73.194.56` | Times out. Use `gcloud compute ssh … --tunnel-through-iap`. |
| Earlier draft | `cd ~/scalablebrain` | Production is `/opt/scalablebrain`, owned by `trader`. |
| Earlier draft | `systemctl restart system3-ams` | The unit is **`s3-ams`**. |
| Earlier draft | `curl localhost:8080/...` | System 2 is `:8002`, System 3 is `:8300`. |
| Earlier draft | `python3 -m py_compile` | Fails on `__pycache__` permissions as non-`trader`. Use `ast.parse`. |
| `telemetry-dashboard/CONNECTIONS.md` | Describes the dashboard app | Describes an app that is **not mounted**. The deployed app is `App.tsx`. |
| `09-LIVE-SIGNAL-PIPELINE.md` | Operating runbook for the live signal pipeline | **WITHDRAWN 2026-08-15.** Record only. |
| `EXEC-011-scored-signal-producer.md` | A build brief | **DO NOT EXECUTE.** The brief itself is the defect. |
| `10-CLOUD-MIGRATION.md` (earlier) | Floated installing Claude Code on the VM | Removed. I-8. |
| `PROJECT.md` | Layer 4 calibration `84,013.70` | Live broker balance is `84,143.79`. The calibrated figure is a Wave-3 constant, not a live reading — do not reconcile one to the other by editing the constant. |
| `system2/`, `system3/`, `bridge/` READMEs | "read-only mirrors" | True, and they are also *stale and divergent in both directions*. Never conclude deployed behaviour from them. |

**The rule:** where a doc and the running system disagree, **the running system wins**, and
the doc gets corrected. Read the VM, not the checkout. The dashboard is the one exception —
there, this checkout is authoritative.

---

## 21. Quick reference

```bash
# ── identity ────────────────────────────────────────────────────────────────
gcloud config list
gcloud config set project scalable-brain

# ── the VM ──────────────────────────────────────────────────────────────────
gcloud compute ssh trading-1 --zone europe-west1-b --project scalable-brain --tunnel-through-iap
# scripted:  … --quiet --command='<cmd>'

# ── stack status ────────────────────────────────────────────────────────────
for u in system2 s3-ams s2s3-bridge s3-signal-relay telemetry-pub s2-downloader; do
  echo "$u $(systemctl is-active $u) NRestarts=$(systemctl show $u -p NRestarts --value)"; done
curl -s http://127.0.0.1:8002/status | python3 -m json.tool
curl -s http://127.0.0.1:8300/state  | python3 -m json.tool
journalctl -u system2 -n 200 --no-pager

# ── operator control (System 3) ─────────────────────────────────────────────
cd /opt/scalablebrain/system3/ams
sudo -u trader ./.venv/bin/python -m ams.ctl status
# pause | resume CONFIRM | flatten CONFIRM | reset_breaker <n> CONFIRM
# clear_recovery CONFIRM | mode shadow | mode enforce CONFIRM | ack

# ── secrets ─────────────────────────────────────────────────────────────────
gcloud secrets versions access latest --secret=telemetry-token       --project=scalable-brain
gcloud secrets versions access latest --secret=telemetry-database-url --project=scalable-brain
gcloud secrets versions access latest --secret=telemetry-redis-url    --project=scalable-brain
sudo cat /opt/scalablebrain/system2/system-2-execution-engine/config/.env.system2   # on the VM
sudo cat /opt/scalablebrain/system3/ams/config/.env.system3                         # on the VM

# ── dashboard deploy ────────────────────────────────────────────────────────
cd telemetry-dashboard && VITE_DATA_MODE=cloud npm run build
rm -f ../cloud/telemetry-web/static/assets/*
cp -r dist/* ../cloud/telemetry-web/static/
cd ../cloud/telemetry-web && gcloud run deploy telemetry-dashboard \
  --source . --region europe-west1 --allow-unauthenticated --project scalable-brain
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://telemetry-dashboard-400868689848.europe-west1.run.app/api/telemetry   # want 401 application/json
gcloud run services update-traffic telemetry-dashboard --region europe-west1 \
  --project scalable-brain --to-latest

# ── cloud data ──────────────────────────────────────────────────────────────
gcloud storage ls gs://scalable-brain-artifacts/
gcloud storage cat gs://scalable-brain-artifacts/telemetry/latest-vm.json | head -c 600
gcloud pubsub topics list --project scalable-brain
gcloud sql instances describe telemetry-db --project scalable-brain
```

### The five numbers to know

| | |
|---|---|
| GCP project / number | `scalable-brain` / `400868689848` |
| VM | `trading-1`, `europe-west1-b`, `/opt/scalablebrain`, user `trader` |
| Ports | System 2 `:8002`, System 3 `:8300`, Postgres `:5432` — all `127.0.0.1` |
| Dashboard | `https://telemetry-dashboard-400868689848.europe-west1.run.app` |
| Broker | OANDA **practice** `101-002-38449021-001`, CAD |

### The five sentences to remember

1. `/opt/scalablebrain` is not a git checkout; editing the repo ships nothing.
2. Deploy `cloud/telemetry-web`, never `telemetry-dashboard/`.
3. The unit is `s3-ams`, not `system3-ams`.
4. A file can be in sync while its collaborators are not.
5. Absent renders as absent — a confident wrong number is worse than a blank panel.

---

*Maintenance: this file is a snapshot with dated evidence. When you find it wrong, correct it
here and note the date, the way §20 does. A runbook that quietly rots is how the last three
incidents happened.*
