/* ============================================================
   system-tree.js — Monorepo Hierarchy, Points of Failure & Playbook
   ============================================================ */

import { $, $$, el, inline, loadJSON, mountChrome } from './core.js';

const FAILURES = [
  {
    component: "SQLite State Databases (ams.db / system2.db)",
    location: "C:\\SB\\prod\\state\\",
    severity: "HIGH",
    symptom: "OperationalError: database is locked or slow telemetry queries",
    rootCause: "Concurrent read-write contention between FastAPI telemetry server and high-frequency AMS Guardian risk evaluations.",
    containment: "Ensure WAL mode (`PRAGMA journal_mode=WAL;`) and busy_timeout=5000ms. Telemetry server queries must connect with `uri=file:...&mode=ro` (read-only connection).",
    diagnosticCmd: "sqlite3 C:\\SB\\prod\\state\\ams.db 'PRAGMA journal_mode; PRAGMA busy_timeout;'",
    recoveryCmd: "python -c \"import sqlite3; con=sqlite3.connect('C:/SB/prod/state/ams.db'); con.execute('PRAGMA wal_checkpoint(TRUNCATE)'); con.close()\""
  },
  {
    component: "OANDA Broker Gateway (REST /candles & orders)",
    location: "systems/bridge/src/broker/",
    severity: "CRITICAL",
    symptom: "502 Bad Gateway / 504 Gateway Timeout on /api/v1/market/candles or order submission",
    rootCause: "OANDA REST API transient latency spikes or rate-limiting (>120 requests/sec limit reached).",
    containment: "Local-first candle resolution from Parquet/SQLite store + in-memory 60s TTL cache with broker quote stitching. Order retries with exponential backoff.",
    diagnosticCmd: "curl -I -m 5 https://api-fxtrade.oanda.com/v3/instruments/EUR_USD/candles?count=1",
    recoveryCmd: "powershell -File C:\\SB\\prod\\services\\sb_service.ps1 restart-service telemetry-server"
  },
  {
    component: "System 1 Signal Batch Pipeline",
    location: "C:\\SB\\data\\artifacts\\system1\\",
    severity: "MEDIUM",
    symptom: "Missing or stale scored signals for H1/H4 bar close (signals older than 4 hours)",
    rootCause: "Heavy feature calculation on 14M rows pegging CPU cores or corrupt parquet partition.",
    containment: "Partition pruning by asset and last 500 bars; incremental cache updates rather than full 18-year recalculation.",
    diagnosticCmd: "dir C:\\SB\\data\\artifacts\\system1\\analytics\\latest.json | select LastWriteTime, Length",
    recoveryCmd: "C:\\SB\\venv-s1\\Scripts\\python.exe systems\\brain\\src\\quant\\pipeline.py --incremental --last 500"
  },
  {
    component: "Operational Log Disk Exhaustion",
    location: "C:\\SB\\prod\\logs\\",
    severity: "LOW",
    symptom: "Disk space warning on C: drive (< 10GB free space remaining)",
    rootCause: "Uncapped debug logging in supervisor or high-frequency quote streaming daemons.",
    containment: "Rotate logs at 50MB with max 5 backups (`RotatingFileHandler(maxBytes=52428800, backupCount=5)`).",
    diagnosticCmd: "Get-ChildItem C:\\SB\\prod\\logs -Recurse | Measure-Object -Property Length -Sum",
    recoveryCmd: "Get-ChildItem C:\\SB\\prod\\logs\\*.log.* | Where-Object LastWriteTime -lt (Get-Date).AddDays(-14) | Remove-Item"
  }
];

const PLAYBOOK = [
  {
    trigger: "Telemetry Dashboard displays '502 Bad Gateway' or blank charts",
    steps: [
      "Check whether FastAPI service on port 8050 is listening: `netstat -ano | findstr 8050`.",
      "Check service supervisor status: `Get-Process python* | Where-Object CommandLine -match 'telemetry'`.",
      "If stopped, restart via supervisor: `powershell -File C:\\SB\\prod\\services\\sb_service.ps1 restart-service telemetry-server`.",
      "Inspect recent logs: `Get-Content C:\\SB\\prod\\logs\\telemetry-server.log -Tail 50`."
    ]
  },
  {
    trigger: "Circuit Breaker Soft Pause (-2.0%) or Hard Halt (-3.0%) tripped",
    steps: [
      "Do NOT override manually without forensic inspection of active open positions.",
      "Query AMS circuit breaker log: `sqlite3 C:\\SB\\prod\\state\\ams.db 'SELECT * FROM ams_circuit_breaker_log ORDER BY log_id DESC LIMIT 5;'`.",
      "Verify live NAV and drawdowns in Telemetry Risk Gate page (`/risk-gate`).",
      "If Soft Pause is valid, let existing positions run to SL/TP while new entries remain blocked.",
      "If Hard Halt, verify that all open orders were cancelled and market orders submitted to flatten exposure."
    ]
  },
  {
    trigger: "Dual-Position EUR_CHF Correlated Exposure Limit breach (>20% NAV)",
    steps: [
      "Open Risk Gate panel and inspect 'True Net Currency Exposure'.",
      "Check `ams_decision_log` for rejection stage code `Stage C / Stage E: max_correlated_exposure_pct`.",
      "If two strategies entered identical directional pairs (e.g., precision_swing and bb_midline_break both Long EUR_CHF), verify that AMS Guardian correctly clamped units on the second entry.",
      "Run unit test: `pytest tests/test_ams_guardian.py -k test_correlated_exposure`."
    ]
  }
];

export async function initSystemTreePage() {
  mountChrome('system-tree');
  const treeData = await loadJSON('data/system-tree.json').catch(() => null);

  renderDirectoryCatalog(treeData);
  renderFailures();
  renderPlaybook();
  bindSearch();
}

function renderDirectoryCatalog(treeData) {
  const container = $('#dir-catalog-container');
  if (!container || !treeData) return;

  container.innerHTML = "";

  (treeData.nodes || []).forEach(node => {
    const card = el('div', { class: 'dict-table-card' },
      el('div', { class: 'dict-table-header' },
        el('div', {},
          el('span', { class: 'badge tone-accent', style: { marginRight: '8px' }, text: node.category || 'Directory' }),
          el('h3', { style: { display: 'inline', fontFamily: 'var(--mono)', fontSize: '1.15rem' }, text: node.path })),
        el('span', { class: 'badge tone-muted', text: node.duty || '' })
      ),
      el('p', { style: { color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: '1.5', margin: '8px 0 16px 0' }, text: node.description }),
      node.subdirectories && node.subdirectories.length > 0 ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        node.subdirectories.map(sub =>
          el('div', { style: { background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' } },
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
              el('span', { style: { fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)' }, text: `📁 ${sub.path}` })),
            el('p', { style: { margin: 0, fontSize: '0.84rem', color: 'var(--text-dim)' }, html: inline(sub.description) })
          )
        )
      ) : null
    );
    container.appendChild(card);
  });
}

function renderFailures() {
  const container = $('#failures-container');
  if (!container) return;

  container.innerHTML = "";

  FAILURES.forEach(f => {
    const card = el('div', { class: 'dict-table-card', style: { borderLeft: `4px solid ${f.severity === 'CRITICAL' ? 'var(--bad)' : f.severity === 'HIGH' ? 'var(--warn)' : 'var(--info)'}` } },
      el('div', { class: 'dict-table-header' },
        el('div', {},
          el('span', { class: `badge tone-${f.severity === 'CRITICAL' ? 'bad' : f.severity === 'HIGH' ? 'warn' : 'info'}`, style: { marginRight: '8px' }, text: f.severity }),
          el('h3', { style: { display: 'inline', fontSize: '1.05rem' }, text: f.component })),
        el('span', { style: { fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--text-faint)' }, text: f.location })
      ),
      el('p', { style: { margin: '8px 0', fontSize: '0.88rem' }, html: `<strong>Symptom:</strong> <span style="color:var(--text-dim);">${f.symptom}</span>` }),
      el('p', { style: { margin: '4px 0 12px 0', fontSize: '0.88rem' }, html: `<strong>Root Cause:</strong> <span style="color:var(--text-dim);">${f.rootCause}</span>` }),
      el('div', { class: 'callout t-info', style: { margin: '10px 0' } },
        el('h4', { text: 'Containment Action' }),
        el('p', { html: inline(f.containment) })
      ),
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginTop: '12px' } },
        el('div', { style: { background: 'var(--bg-sunken)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' } },
          el('span', { style: { fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', fontFamily: 'var(--mono)' }, text: 'Diagnostic Command' }),
          el('pre', { style: { margin: '4px 0 0 0', fontSize: '0.78rem', overflowX: 'auto' } }, el('code', { text: f.diagnosticCmd }))),
        el('div', { style: { background: 'var(--bg-sunken)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' } },
          el('span', { style: { fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', fontFamily: 'var(--mono)' }, text: 'Recovery Command' }),
          el('pre', { style: { margin: '4px 0 0 0', fontSize: '0.78rem', overflowX: 'auto' } }, el('code', { text: f.recoveryCmd })))
      )
    );
    container.appendChild(card);
  });
}

function renderPlaybook() {
  const container = $('#playbook-container');
  if (!container) return;

  container.innerHTML = "";

  PLAYBOOK.forEach((item, idx) => {
    const details = el('details', { class: 'dict-table-card', open: idx === 0, style: { cursor: 'pointer' } },
      el('summary', { style: { fontWeight: '700', fontSize: '1rem', color: 'var(--text)' } }, `🚨 ${item.trigger}`),
      el('ol', { style: { marginTop: '14px', paddingLeft: '20px', lineHeight: '1.6', fontSize: '0.88rem', color: 'var(--text-dim)' } },
        item.steps.map(step => el('li', { style: { marginBottom: '8px' }, html: inline(step) }))
      )
    );
    container.appendChild(details);
  });
}

function bindSearch() {
  const input = $('#tree-search-input');
  if (!input) return;

  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    $$('#dir-catalog-container .dict-table-card').forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    $$('#failures-container .dict-table-card').forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}
