/* ============================================================
   erd.js — Interactive ERD & Data Lineage Canvas
   Covers live production stores: ams.db, system2.db,
   PostgreSQL scalable_brain, and Parquet/SQLite artifacts.
   ============================================================ */

import { $, $$, el, inline, mountChrome } from './core.js';

const TABLE_DATA = [
  /* ---------------- Column 1: Ingestion & Market Store ---------------- */
  {
    name: "dim_asset",
    type: "dimension",
    store: "PostgreSQL · scalable_brain",
    stage: 1,
    stageLabel: "Stage 1 · Market Ingestion",
    rows: 15,
    size: "56 KB",
    pk: ["asset_id"],
    description: "Canonical forex currency pairs (EUR_USD, USD_JPY, GBP_USD, USD_CHF, AUD_USD, USD_CAD, NZD_USD, etc.). Defines active status, quote/base currencies, and pip size.",
    auditorNotes: "Conformed dimension hub. Symbols strictly adhere to OANDA broker conventions.",
    graphPos: { x: 50, y: 60, tag: "CONFORMED", presets: ["all", "galaxy", "lineage", "trade-flow"] },
    columns: [
      { name: "asset_id", type: "INT", isPK: true, desc: "Surrogate key for the currency pair" },
      { name: "symbol", type: "VARCHAR(20)", desc: "OANDA instrument code (e.g., EUR_USD)" },
      { name: "base_currency", type: "VARCHAR(10)", desc: "First currency in pair (e.g., EUR)" },
      { name: "quote_currency", type: "VARCHAR(10)", desc: "Second currency in pair (e.g., USD)" },
      { name: "pip_size", type: "NUMERIC(8,5)", desc: "Pip unit multiplier (0.0001 or 0.01 for JPY)" },
      { name: "is_active", type: "BOOLEAN", desc: "Flag enabling continuous data streaming" }
    ],
    fks: []
  },
  {
    name: "fact_market_prices",
    type: "fact",
    store: "Parquet Store / SQLite / PG",
    stage: 1,
    stageLabel: "Stage 1 · Market Ingestion",
    rows: 14342088,
    size: "3,008 MB",
    pk: ["timestamp", "asset_id", "granularity"],
    description: "Continuous 18-year OHLCV candlestick store ingested from OANDA broker API across H1, H4, and D1 granularities. Serves local-first candle cache.",
    auditorNotes: "Largest fact table in system (50.3% of storage). Serves S1 feature calculation and telemetry charts.",
    graphPos: { x: 50, y: 240, tag: "CANDLES", presets: ["all", "galaxy", "quant", "trade-flow"] },
    columns: [
      { name: "timestamp", type: "TIMESTAMPTZ", isPK: true, desc: "UTC timestamp of bar open" },
      { name: "asset_id", type: "INT", isPK: true, isFK: true, fkTarget: "dim_asset.asset_id", desc: "FK to dim_asset" },
      { name: "granularity", type: "VARCHAR(5)", isPK: true, desc: "Timeframe (H1, H4, D1)" },
      { name: "open", type: "NUMERIC(12,6)", desc: "Opening mid price" },
      { name: "high", type: "NUMERIC(12,6)", desc: "Highest mid price" },
      { name: "low", type: "NUMERIC(12,6)", desc: "Lowest mid price" },
      { name: "close", type: "NUMERIC(12,6)", desc: "Closing mid price" },
      { name: "volume", type: "INT", desc: "Tick volume traded during bar interval" }
    ],
    fks: [{ col: "asset_id", target: "dim_asset" }]
  },
  {
    name: "fact_market_prices_quarantine",
    type: "operational",
    store: "PostgreSQL · scalable_brain",
    stage: 1,
    stageLabel: "Stage 1 · Data Quality Quarantine",
    rows: 42,
    size: "128 KB",
    pk: ["quarantine_id"],
    description: "Anomalous tick data (negative spreads, inverted high/low, stale timestamps) isolated before hitting analytical price stores.",
    auditorNotes: "Strict data quality gatekeeper preventing bad ticks from polluting ML feature computation.",
    graphPos: { x: 50, y: 440, tag: "AUDIT", presets: ["all", "audit"] },
    columns: [
      { name: "quarantine_id", type: "BIGSERIAL", isPK: true, desc: "Surrogate auto-increment key" },
      { name: "raw_payload", type: "JSONB", desc: "Raw rejected broker payload" },
      { name: "rejection_reason", type: "VARCHAR(255)", desc: "Validation check failure code" },
      { name: "created_at", type: "TIMESTAMPTZ", desc: "UTC timestamp of capture" }
    ],
    fks: []
  },

  /* ---------------- Column 2: Quant Strategies & ML Signals ---------------- */
  {
    name: "dim_strategy",
    type: "dimension",
    store: "latest.json / PG dim_strategy",
    stage: 2,
    stageLabel: "Stage 2 · Quant Factory",
    rows: 67,
    size: "48 KB",
    pk: ["strategy_id"],
    description: "Canonical registry of all 67 quantitative trading strategies. Contains strategy family, core timeframes, indicators, and edge mechanics.",
    auditorNotes: "Versioned catalog tracking strategy metadata. 7 strategies currently live-qualified.",
    graphPos: { x: 360, y: 60, tag: "CATALOG", presets: ["all", "galaxy", "quant", "trade-flow"] },
    columns: [
      { name: "strategy_id", type: "INT", isPK: true, desc: "Unique strategy integer ID (1..67)" },
      { name: "strategy_key", type: "VARCHAR(60)", desc: "Slug identifier (e.g., precision_swing)" },
      { name: "strategy_name", type: "VARCHAR(100)", desc: "Formal title" },
      { name: "family", type: "VARCHAR(40)", desc: "Quant family (Mean-Reversion, Trend-Following, Breakout, etc.)" },
      { name: "granularity", type: "VARCHAR(10)", desc: "Execution timeframe (H1, H4, D1)" },
      { name: "is_active", type: "BOOLEAN", desc: "Active in live discovery pool" }
    ],
    fks: []
  },
  {
    name: "dim_strategy_config",
    type: "dimension",
    store: "PostgreSQL · scalable_brain",
    stage: 2,
    stageLabel: "Stage 2 · Quant Factory",
    rows: 67,
    size: "96 KB",
    pk: ["config_id"],
    description: "Exact mathematical parameters for each strategy: indicator lookbacks, ATR stop/target multipliers, and ML feature weights.",
    auditorNotes: "Every parameter alteration creates an immutable config version with SHA hash.",
    graphPos: { x: 360, y: 220, tag: "CONFIG", presets: ["all", "quant"] },
    columns: [
      { name: "config_id", type: "INT", isPK: true, desc: "Surrogate configuration key" },
      { name: "strategy_id", type: "INT", isFK: true, fkTarget: "dim_strategy.strategy_id", desc: "FK to dim_strategy" },
      { name: "parameters", type: "JSONB", desc: "Hyperparameters (lookbacks, multipliers)" },
      { name: "atr_sl_multiplier", type: "NUMERIC(6,2)", desc: "Stop loss ATR scalar" },
      { name: "atr_tp_multiplier", type: "NUMERIC(6,2)", desc: "Take profit ATR scalar" },
      { name: "config_hash", type: "VARCHAR(64)", desc: "Git commit / param hash" }
    ],
    fks: [{ col: "strategy_id", target: "dim_strategy" }]
  },
  {
    name: "fact_regime_structural",
    type: "fact",
    store: "PostgreSQL / SQLite",
    stage: 2,
    stageLabel: "Stage 2 · Regime Clustering",
    rows: 482100,
    size: "180 MB",
    pk: ["timestamp", "asset_id"],
    description: "Hidden Markov Model (HMM) and structural regime state for each asset bar: Bull Trend, Bear Trend, Range/Mean-Reverting, High Volatility.",
    auditorNotes: "Used by System 1 to gate strategy signal generation to matching market conditions.",
    graphPos: { x: 360, y: 380, tag: "REGIMES", presets: ["all", "quant", "galaxy"] },
    columns: [
      { name: "timestamp", type: "TIMESTAMPTZ", isPK: true, desc: "Bar timestamp" },
      { name: "asset_id", type: "INT", isPK: true, isFK: true, fkTarget: "dim_asset.asset_id", desc: "FK to dim_asset" },
      { name: "regime", type: "VARCHAR(30)", desc: "Structural state (e.g. Bullish_Momentum, Range_Bound)" },
      { name: "confidence", type: "NUMERIC(5,4)", desc: "HMM posterior probability" }
    ],
    fks: [{ col: "asset_id", target: "dim_asset" }]
  },
  {
    name: "s1_scored_signals_log",
    type: "fact",
    store: "data/artifacts/system1 / PG",
    stage: 2,
    stageLabel: "Stage 2 · Scored Signals",
    rows: 18240,
    size: "24 MB",
    pk: ["signal_id"],
    description: "Discrete candidate buy/sell signals generated by active strategies, enhanced with XGBoost meta-label win-probability scores and recommended SL/TP.",
    auditorNotes: "Acts as the contract handover boundary between System 1 (Factory) and System 3 (Guardian Risk).",
    graphPos: { x: 360, y: 540, tag: "SIGNALS", presets: ["all", "trade-flow", "quant", "lineage", "risk"] },
    columns: [
      { name: "signal_id", type: "VARCHAR(64)", isPK: true, desc: "Unique hash of signal event" },
      { name: "strategy_id", type: "INT", isFK: true, fkTarget: "dim_strategy.strategy_id", desc: "FK to dim_strategy" },
      { name: "symbol", type: "VARCHAR(20)", desc: "Currency pair symbol" },
      { name: "direction", type: "VARCHAR(5)", desc: "LONG or SHORT" },
      { name: "model_score", type: "NUMERIC(5,4)", desc: "XGBoost meta-label confidence (0.0 to 1.0)" },
      { name: "proposed_entry", type: "NUMERIC(12,6)", desc: "Target entry limit price" },
      { name: "proposed_sl", type: "NUMERIC(12,6)", desc: "Calculated structural stop price" },
      { name: "proposed_tp", type: "NUMERIC(12,6)", desc: "Target profit price" },
      { name: "created_at", type: "TIMESTAMPTZ", desc: "UTC timestamp of signal generation" }
    ],
    fks: [{ col: "strategy_id", target: "dim_strategy" }]
  },

  /* ---------------- Column 3: System 3 AMS Guardian Risk Gate ---------------- */
  {
    name: "ams_market_prices",
    type: "operational",
    store: "ams.db (SQLite WAL)",
    stage: 3,
    stageLabel: "Stage 3 · AMS Risk Gate",
    rows: 15,
    size: "32 KB",
    pk: ["symbol"],
    description: "In-memory / SQLite high-speed cache of live broker bid/ask/mid prices and USD/CAD conversion rates used for instantaneous real-time position sizing and margin validation.",
    auditorNotes: "Updated every 15-30s from OANDA streaming quotes. Enables offline-resilient local currency conversion.",
    graphPos: { x: 680, y: 60, tag: "CACHE", presets: ["all", "risk"] },
    columns: [
      { name: "symbol", type: "VARCHAR(20)", isPK: true, desc: "Currency pair symbol" },
      { name: "bid", type: "NUMERIC(12,6)", desc: "Current best broker bid" },
      { name: "ask", type: "NUMERIC(12,6)", desc: "Current best broker ask" },
      { name: "mid", type: "NUMERIC(12,6)", desc: "Current mid price" },
      { name: "cad_conversion_rate", type: "NUMERIC(12,6)", desc: "Multiplier to account currency (CAD)" },
      { name: "updated_at", type: "TIMESTAMPTZ", desc: "Timestamp of last quote tick" }
    ],
    fks: []
  },
  {
    name: "ams_circuit_breaker_log",
    type: "operational",
    store: "ams.db (SQLite WAL)",
    stage: 3,
    stageLabel: "Stage 3 · Circuit Breakers",
    rows: 84,
    size: "64 KB",
    pk: ["log_id"],
    description: "Audit trail of portfolio circuit breaker evaluations: Soft Pause (-2.0% daily NAV loss halts new entries) and Hard Halt (-3.0% daily loss flattens all exposure).",
    auditorNotes: "Autonomous safety valve enforcing capital preservation under structural stress.",
    graphPos: { x: 680, y: 220, tag: "BREAKER", presets: ["all", "risk"] },
    columns: [
      { name: "log_id", type: "INTEGER", isPK: true, desc: "Auto-increment primary key" },
      { name: "timestamp", type: "TEXT", desc: "ISO 8601 UTC timestamp" },
      { name: "daily_pnl_pct", type: "REAL", desc: "Today's realized + unrealized PnL vs NAV" },
      { name: "peak_nav", type: "REAL", desc: "High water mark NAV" },
      { name: "current_nav", type: "REAL", desc: "Current live account balance + unrealized" },
      { name: "state", type: "TEXT", desc: "HEALTHY, SOFT_PAUSE, or HARD_HALT" },
      { name: "actions_triggered", type: "TEXT", desc: "Actions executed by Guardian" }
    ],
    fks: []
  },
  {
    name: "ams_decision_log",
    type: "fact",
    store: "ams.db (SQLite WAL)",
    stage: 3,
    stageLabel: "Stage 3 · AMS Risk Gate",
    rows: 1542,
    size: "1,240 KB",
    pk: ["decision_id"],
    description: "Forensic decision ledger for every signal evaluated through the 10-stage Guardian pipeline (Stages P->J). Records approval, sizing reduction, or rejection with exact stage reason.",
    auditorNotes: "Core accountability hub for risk management. Proves whether Kelly sizing, slot cap (10), or 20% currency limit reduced or blocked risk.",
    graphPos: { x: 680, y: 380, tag: "GUARDIAN", presets: ["all", "risk", "trade-flow", "lineage"] },
    columns: [
      { name: "decision_id", type: "TEXT", isPK: true, desc: "UUID / hash of risk evaluation" },
      { name: "signal_id", type: "TEXT", isFK: true, fkTarget: "s1_scored_signals_log.signal_id", desc: "Signal reference" },
      { name: "symbol", type: "TEXT", desc: "Currency pair symbol" },
      { name: "strategy", type: "TEXT", desc: "Strategy name and timeframe" },
      { name: "status", type: "TEXT", desc: "APPROVED, REDUCED, or REJECTED" },
      { name: "requested_units", type: "INTEGER", desc: "Units proposed by S1 factory" },
      { name: "approved_units", type: "INTEGER", desc: "Final units authorized after Kelly & limits" },
      { name: "rejection_reason", type: "TEXT", desc: "Stage code & text (e.g. Stage E: Max concurrent 10/10)" },
      { name: "currency_exposure_pct", type: "REAL", desc: "Currency directional exposure after entry" },
      { name: "created_at", type: "TEXT", desc: "UTC timestamp" }
    ],
    fks: [{ col: "signal_id", target: "s1_scored_signals_log" }]
  },
  {
    name: "ams_open_positions",
    type: "operational",
    store: "ams.db (SQLite WAL)",
    stage: 3,
    stageLabel: "Stage 3 · Active Book",
    rows: 10,
    size: "48 KB",
    pk: ["trade_id"],
    description: "Active open trading inventory tracked by AMS Guardian: live unrealized P&L in CAD, risk at stop loss in CAD & % NAV, dynamic SL/TP, and live R multiple.",
    auditorNotes: "Synchronized with OANDA openTrades and enriched with S1 attribution for dashboard cockpit.",
    graphPos: { x: 680, y: 540, tag: "BOOK", presets: ["all", "risk", "trade-flow", "lineage"] },
    columns: [
      { name: "trade_id", type: "TEXT", isPK: true, desc: "Broker trade ID" },
      { name: "symbol", type: "TEXT", desc: "Currency pair symbol" },
      { name: "strategy", type: "TEXT", desc: "Attributed strategy" },
      { name: "regime", type: "TEXT", desc: "Market regime at entry" },
      { name: "units", type: "INTEGER", desc: "Position volume" },
      { name: "entry_price", type: "REAL", desc: "Actual broker fill price" },
      { name: "current_price", type: "REAL", desc: "Live market quote" },
      { name: "stop_loss", type: "REAL", desc: "Protective stop price" },
      { name: "take_profit", type: "REAL", desc: "Target profit price" },
      { name: "risk_at_sl_cad", type: "REAL", desc: "CAD currency loss if SL hit" },
      { name: "unrealized_pnl_cad", type: "REAL", desc: "Current floating P&L in CAD" },
      { name: "live_r", type: "REAL", desc: "Current R-multiple based on initial risk" },
      { name: "opened_at", type: "TEXT", desc: "UTC timestamp" }
    ],
    fks: []
  },

  /* ---------------- Column 4: System 2 Execution & Broker ---------------- */
  {
    name: "fact_live_trades",
    type: "fact",
    store: "system2.db / PG fact_live_trades",
    stage: 4,
    stageLabel: "Stage 4 · Broker Execution",
    rows: 1248,
    size: "820 KB",
    pk: ["trade_id"],
    description: "Broker execution facts captured by System 2: fill prices, execution slippage, financing/rollover costs, realized PnL, and close timestamps.",
    auditorNotes: "Ground-truth broker ledger directly populated from OANDA v20 transaction streaming.",
    graphPos: { x: 1000, y: 380, tag: "EXECUTION", presets: ["all", "trade-flow", "lineage", "galaxy"] },
    columns: [
      { name: "trade_id", type: "VARCHAR(40)", isPK: true, desc: "OANDA broker order identifier" },
      { name: "order_id", type: "VARCHAR(40)", desc: "Broker order submission reference" },
      { name: "symbol", type: "VARCHAR(20)", desc: "Instrument traded" },
      { name: "units", type: "INT", desc: "Executed contract size" },
      { name: "fill_price", type: "NUMERIC(12,6)", desc: "Average broker execution fill" },
      { name: "slippage_pips", type: "NUMERIC(6,2)", desc: "Variance between proposed and actual fill" },
      { name: "stop_loss", type: "NUMERIC(12,6)", desc: "Active broker stop order" },
      { name: "take_profit", type: "NUMERIC(12,6)", desc: "Active broker limit take-profit" },
      { name: "realised_pnl", type: "NUMERIC(12,2)", desc: "Realized cash PnL in CAD upon closure" },
      { name: "financing", type: "NUMERIC(10,2)", desc: "Overnight rollover financing drag in CAD" },
      { name: "status", type: "VARCHAR(20)", desc: "OPEN, CLOSED, or CANCELLED" },
      { name: "opened_at", type: "TIMESTAMPTZ", desc: "Execution fill timestamp" },
      { name: "closed_at", type: "TIMESTAMPTZ", desc: "Position exit timestamp" }
    ],
    fks: []
  },
  {
    name: "fact_order_audit",
    type: "operational",
    store: "system2.db (SQLite WAL)",
    stage: 4,
    stageLabel: "Stage 4 · Execution Latency & Audit",
    rows: 4890,
    size: "610 KB",
    pk: ["audit_id"],
    description: "Sub-second network audit logs of every REST call and websocket push to OANDA v20 API, logging round-trip latency, HTTP status, and rate-limit headers.",
    auditorNotes: "Ensures execution bridge operates under 120ms round-trip latency budget.",
    graphPos: { x: 1000, y: 540, tag: "LATENCY", presets: ["all", "audit"] },
    columns: [
      { name: "audit_id", type: "BIGSERIAL", isPK: true, desc: "Auto-increment key" },
      { name: "trade_id", type: "VARCHAR(40)", isFK: true, fkTarget: "fact_live_trades.trade_id", desc: "FK to fact_live_trades" },
      { name: "latency_ms", type: "INT", desc: "Round-trip broker latency in milliseconds" },
      { name: "http_status", type: "INT", desc: "HTTP response code (200, 201, 504, etc.)" },
      { name: "endpoint", type: "VARCHAR(100)", desc: "Broker REST API path" },
      { name: "created_at", type: "TIMESTAMPTZ", desc: "Execution timestamp" }
    ],
    fks: [{ col: "trade_id", target: "fact_live_trades" }]
  },

  /* ---------------- Column 5: Post-Trade Analytics & Journal ---------------- */
  {
    name: "trade_journal",
    type: "fact",
    store: "PostgreSQL · scalable_brain",
    stage: 5,
    stageLabel: "Stage 5 · Post-Trade Journal",
    rows: 1248,
    size: "1,450 KB",
    pk: ["journal_id"],
    description: "End-to-end master trade ledger that links the originating S1 signal, S3 Guardian risk decision, and S2 broker execution into a single unified record with the 6-card payload (SIG, PLN, EXE, MKT, P&L, GOV).",
    auditorNotes: "Eliminates dual-identity ambiguity. Powers the Dashboard 6-card trade inspector.",
    graphPos: { x: 1320, y: 240, tag: "JOURNAL", presets: ["all", "galaxy", "lineage", "trade-flow"] },
    columns: [
      { name: "journal_id", type: "BIGSERIAL", isPK: true, desc: "Surrogate master journal key" },
      { name: "trade_id", type: "VARCHAR(40)", isFK: true, fkTarget: "fact_live_trades.trade_id", desc: "FK to fact_live_trades" },
      { name: "decision_id", type: "VARCHAR(64)", isFK: true, fkTarget: "ams_decision_log.decision_id", desc: "FK to ams_decision_log" },
      { name: "strategy_id", type: "INT", isFK: true, fkTarget: "dim_strategy.strategy_id", desc: "FK to dim_strategy" },
      { name: "r_multiple", type: "NUMERIC(6,2)", desc: "Final realized R-multiple vs initial stop" },
      { name: "realised_pnl_cad", type: "NUMERIC(12,2)", desc: "Net realized cash PnL in CAD" },
      { name: "holding_hours", type: "NUMERIC(8,2)", desc: "Trade duration from fill to close" },
      { name: "exit_reason", type: "VARCHAR(40)", desc: "TAKE_PROFIT, STOP_LOSS, TIME_DECAY, or GUARDIAN_HALT" },
      { name: "six_card_payload", type: "JSONB", desc: "Full inspection snapshot for UI expansion" }
    ],
    fks: [
      { col: "trade_id", target: "fact_live_trades" },
      { col: "decision_id", target: "ams_decision_log" },
      { col: "strategy_id", target: "dim_strategy" }
    ]
  },
  {
    name: "fact_strategy_regime_attribution",
    type: "fact",
    store: "PostgreSQL · scalable_brain",
    stage: 5,
    stageLabel: "Stage 5 · Quant Attribution",
    rows: 420,
    size: "180 KB",
    pk: ["attribution_id"],
    description: "Multivariate attribution matrix breaking down strategy performance across distinct market regimes: Win Rate, Profit Factor, Sharpe Ratio, and Drawdown.",
    auditorNotes: "Identifies whether an edge is failing due to strategy decay or unexpected regime shifts.",
    graphPos: { x: 1320, y: 440, tag: "ATTRIBUTION", presets: ["all", "galaxy", "quant"] },
    columns: [
      { name: "attribution_id", type: "BIGSERIAL", isPK: true, desc: "Surrogate key" },
      { name: "strategy_id", type: "INT", isFK: true, fkTarget: "dim_strategy.strategy_id", desc: "FK to dim_strategy" },
      { name: "regime", type: "VARCHAR(40)", desc: "Market regime category" },
      { name: "win_rate", type: "NUMERIC(5,4)", desc: "Historical win percentage" },
      { name: "profit_factor", type: "NUMERIC(6,2)", desc: "Gross profits divided by gross losses" },
      { name: "sharpe", type: "NUMERIC(6,2)", desc: "Annualized Sharpe ratio" },
      { name: "max_drawdown", type: "NUMERIC(5,4)", desc: "Maximum observed peak-to-trough decline" }
    ],
    fks: [{ col: "strategy_id", target: "dim_strategy" }]
  },
  {
    name: "fact_job_runs",
    type: "operational",
    store: "PostgreSQL · scalable_brain",
    stage: 5,
    stageLabel: "Stage 5 · Daemon Telemetry",
    rows: 9240,
    size: "1,120 KB",
    pk: ["job_run_id"],
    description: "Execution telemetry for background cron jobs and daemons (S1 feature calculation, S2 broker sync, S3 Guardian audits, daily backups).",
    auditorNotes: "Monitored by System 4 Telemetry server to alert on missed runs or unhandled exceptions.",
    graphPos: { x: 1320, y: 600, tag: "JOBS", presets: ["all", "audit"] },
    columns: [
      { name: "job_run_id", type: "BIGSERIAL", isPK: true, desc: "Auto-increment key" },
      { name: "job_name", type: "VARCHAR(80)", desc: "Process identifier" },
      { name: "started_at", type: "TIMESTAMPTZ", desc: "Start timestamp" },
      { name: "ended_at", type: "TIMESTAMPTZ", desc: "Completion timestamp" },
      { name: "status", type: "VARCHAR(20)", desc: "SUCCESS, FAILED, or TIMED_OUT" }
    ],
    fks: []
  }
];

const GRAPH_EDGES = [
  { source: "dim_asset", target: "fact_market_prices", card: "1 : N", color: "dim", presets: ["all", "galaxy", "lineage", "trade-flow"] },
  { source: "dim_asset", target: "fact_regime_structural", card: "1 : N", color: "dim", presets: ["all", "galaxy", "quant"] },
  { source: "dim_strategy", target: "dim_strategy_config", card: "1 : N", color: "dim", presets: ["all", "quant"] },
  { source: "dim_strategy", target: "s1_scored_signals_log", card: "1 : N", color: "dim", presets: ["all", "quant", "trade-flow", "lineage"] },
  { source: "fact_market_prices", target: "s1_scored_signals_log", card: "1 : N", color: "fact", presets: ["all", "quant", "trade-flow"] },
  { source: "fact_regime_structural", target: "s1_scored_signals_log", card: "1 : N", color: "fact", presets: ["all", "quant"] },
  { source: "s1_scored_signals_log", target: "ams_decision_log", card: "1 : 1", color: "fact", presets: ["all", "risk", "trade-flow", "lineage"] },
  { source: "ams_market_prices", target: "ams_decision_log", card: "N : 1", color: "op", presets: ["all", "risk"] },
  { source: "ams_circuit_breaker_log", target: "ams_decision_log", card: "1 : N", color: "op", presets: ["all", "risk"] },
  { source: "ams_decision_log", target: "ams_open_positions", card: "1 : 1", color: "op", presets: ["all", "risk", "trade-flow", "lineage"] },
  { source: "ams_open_positions", target: "fact_live_trades", card: "1 : 1", color: "fact", presets: ["all", "trade-flow", "lineage"] },
  { source: "fact_live_trades", target: "fact_order_audit", card: "1 : N", color: "fact", presets: ["all", "audit"] },
  { source: "fact_live_trades", target: "trade_journal", card: "1 : 1", color: "fact", presets: ["all", "galaxy", "trade-flow", "lineage"] },
  { source: "ams_decision_log", target: "trade_journal", card: "1 : 1", color: "fact", presets: ["all", "lineage", "trade-flow"] },
  { source: "dim_strategy", target: "trade_journal", card: "1 : N", color: "dim", presets: ["all", "galaxy", "lineage"] },
  { source: "dim_strategy", target: "fact_strategy_regime_attribution", card: "1 : N", color: "dim", presets: ["all", "galaxy", "quant"] }
];

/* ---------------- State Management ---------------- */
const state = {
  preset: "all",
  searchQuery: "",
  pinnedNode: null,
  zoom: 0.9,
  panX: 40,
  panY: 30,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0
};

export function initErdPage() {
  mountChrome('erd');
  renderControls();
  renderCanvas();
  bindEvents();
}

function renderControls() {
  const filterWrap = $('#erd-filter-group');
  if (!filterWrap) return;

  const presets = [
    { id: "all", label: "All Tables (17)" },
    { id: "trade-flow", label: "Core Trade Flow (6)" },
    { id: "risk", label: "AMS Guardian Risk (5)" },
    { id: "quant", label: "Quant Factory & Regimes (6)" },
    { id: "galaxy", label: "Galaxy Constellation (7)" },
    { id: "audit", label: "Audit & Telemetry (4)" }
  ];

  filterWrap.innerHTML = "";
  presets.forEach(p => {
    const btn = el('button', {
      class: `erd-pill-btn ${state.preset === p.id ? "active" : ""}`,
      text: p.label,
      onclick: () => {
        state.preset = p.id;
        state.pinnedNode = null;
        $$('.erd-pill-btn', filterWrap).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCanvas();
      }
    });
    filterWrap.appendChild(btn);
  });
}

function renderCanvas() {
  const svgGroup = $('#erd-svg-content');
  if (!svgGroup) return;

  svgGroup.innerHTML = "";
  svgGroup.setAttribute("transform", `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`);

  const q = state.searchQuery.trim().toLowerCase();

  const isVisible = (t) => {
    if (state.preset !== "all" && !t.graphPos.presets.includes(state.preset)) return false;
    if (q) {
      const matchName = t.name.toLowerCase().includes(q);
      const matchCol = t.columns.some(c => c.name.toLowerCase().includes(q));
      const matchDesc = (t.description || "").toLowerCase().includes(q);
      if (!matchName && !matchCol && !matchDesc) return false;
    }
    return true;
  };

  // Render Edges
  GRAPH_EDGES.forEach(edge => {
    const sNode = TABLE_DATA.find(x => x.name === edge.source);
    const tNode = TABLE_DATA.find(x => x.name === edge.target);
    if (!sNode || !tNode) return;

    const sVis = isVisible(sNode);
    const tVis = isVisible(tNode);
    const inPreset = state.preset === "all" || edge.presets.includes(state.preset);
    const dimmed = !sVis || !tVis || !inPreset;

    const sX = sNode.graphPos.x + 115;
    const sY = sNode.graphPos.y + 55;
    const tX = tNode.graphPos.x + 115;
    const tY = tNode.graphPos.y + 55;
    const midX = (sX + tX) / 2;
    const midY = (sY + tY) / 2;

    const dPath = `M ${sX} ${sY} C ${sX} ${midY}, ${tX} ${midY}, ${tX} ${tY}`;

    const strokeMap = { dim: "#3b82f6", fact: "#10b981", op: "#f59e0b" };
    const strokeColor = strokeMap[edge.color] || "#3b82f6";
    const highlighted = state.pinnedNode && (edge.source === state.pinnedNode || edge.target === state.pinnedNode);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `svg-rel-link ${dimmed ? "dimmed" : ""} ${highlighted ? "highlighted" : ""}`);
    g.onclick = (e) => {
      e.stopPropagation();
      openInspector(edge.target);
    };

    g.innerHTML = `
      <path class="rel-path" d="${dPath}" fill="none" stroke="${strokeColor}" stroke-width="${highlighted ? 3.5 : 2.2}" marker-end="url(#arrow-${edge.color})"/>
      <rect x="${midX - 28}" y="${midY - 10}" width="56" height="18" rx="4" fill="var(--bg-sunken)" stroke="${strokeColor}" stroke-width="1.2"/>
      <text x="${midX}" y="${midY + 3}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="700" fill="var(--text)">${edge.card}</text>
    `;
    svgGroup.appendChild(g);
  });

  // Render Nodes
  TABLE_DATA.forEach(t => {
    const vis = isVisible(t);
    const isPinned = state.pinnedNode === t.name;

    const colorMap = {
      dimension: { stroke: "#3b82f6", header: "rgba(59, 130, 246, 0.22)" },
      fact: { stroke: "#10b981", header: "rgba(16, 185, 129, 0.22)" },
      operational: { stroke: "#f59e0b", header: "rgba(245, 158, 11, 0.22)" }
    };
    const c = colorMap[t.type] || colorMap.fact;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `svg-table-node ${!vis ? "dimmed" : ""} ${isPinned ? "pinned" : ""}`);
    g.onclick = (e) => {
      e.stopPropagation();
      state.pinnedNode = state.pinnedNode === t.name ? null : t.name;
      renderCanvas();
      openInspector(t.name);
    };

    const { x, y, tag } = t.graphPos;
    const pkPreview = t.pk.join(", ");

    g.innerHTML = `
      <rect class="node-frame" x="${x}" y="${y}" width="230" height="110" rx="8" fill="var(--bg-surface)" stroke="${c.stroke}" stroke-width="2"/>
      <rect x="${x}" y="${y}" width="230" height="30" rx="8" fill="${c.header}"/>
      <text x="${x + 10}" y="${y + 20}" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="var(--text)">${t.name}</text>
      <rect x="${x + 155}" y="${y + 6}" width="65" height="18" rx="4" fill="${c.stroke}"/>
      <text x="${x + 187}" y="${y + 18}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="#ffffff">${tag}</text>
      <text x="${x + 10}" y="${y + 50}" font-family="'JetBrains Mono', monospace" font-size="10" fill="var(--text-dim)">PK: ${pkPreview}</text>
      <text x="${x + 10}" y="${y + 70}" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" fill="var(--text-faint)">${t.stageLabel}</text>
      <text x="${x + 10}" y="${y + 92}" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="700" fill="${c.stroke}">${t.rows.toLocaleString()} rows · ${t.size}</text>
    `;
    svgGroup.appendChild(g);
  });
}

function openInspector(tableName) {
  const t = TABLE_DATA.find(x => x.name === tableName);
  if (!t) return;

  const drawer = $('#erd-drawer');
  if (!drawer) return;

  $('#erd-drawer-title').textContent = t.name;
  $('#erd-drawer-subtitle').textContent = `${t.store} · ${t.stageLabel}`;

  const content = $('#erd-drawer-content');
  content.innerHTML = "";

  // Stats
  const statGrid = el('div', { class: 'erd-stat-grid' },
    el('div', { class: 'erd-stat-card' },
      el('div', { class: 'erd-stat-label', text: 'Total Records' }),
      el('div', { class: 'erd-stat-val', text: t.rows.toLocaleString() })),
    el('div', { class: 'erd-stat-card' },
      el('div', { class: 'erd-stat-label', text: 'Disk Footprint' }),
      el('div', { class: 'erd-stat-val', text: t.size })),
    el('div', { class: 'erd-stat-card' },
      el('div', { class: 'erd-stat-label', text: 'Primary Key' }),
      el('div', { class: 'erd-stat-val', text: t.pk.join(", ") })),
    el('div', { class: 'erd-stat-card' },
      el('div', { class: 'erd-stat-label', text: 'Category' }),
      el('div', { class: 'erd-stat-val', text: t.type.toUpperCase() }))
  );
  content.appendChild(statGrid);

  // Purpose
  const descSection = el('div', {},
    el('h4', { style: { margin: '0 0 6px 0', fontSize: '0.88rem', color: 'var(--text-dim)' }, text: 'Purpose & Mechanics' }),
    el('p', { style: { margin: 0, fontSize: '0.88rem', lineHeight: '1.5' }, text: t.description })
  );
  content.appendChild(descSection);

  // Auditor Notes
  if (t.auditorNotes) {
    const notesSection = el('div', { class: 'callout t-info' },
      el('h4', { text: 'Auditor & Integrity Remarks' }),
      el('p', { text: t.auditorNotes })
    );
    content.appendChild(notesSection);
  }

  // Columns Table
  const colWrap = el('div', {},
    el('h4', { style: { margin: '0 0 8px 0', fontSize: '0.88rem', color: 'var(--text-dim)' }, text: `Columns & Schema (${t.columns.length})` }),
    el('table', { class: 'erd-col-table' },
      el('thead', {},
        el('tr', {},
          el('th', { text: 'Column' }),
          el('th', { text: 'Type' }),
          el('th', { text: 'Description' }))),
      el('tbody', {},
        t.columns.map(col =>
          el('tr', {},
            el('td', {},
              col.isPK ? el('span', { class: 'erd-pk-badge', text: 'PK' }) : null,
              col.isFK ? el('span', { class: 'erd-fk-badge', text: 'FK' }) : null,
              el('span', { class: 'erd-col-name', text: col.name })),
            el('td', { class: 'erd-col-type', text: col.type }),
            el('td', { style: { fontSize: '0.78rem', color: 'var(--text-dim)' }, text: col.desc || '' })
          )
        )
      )
    )
  );
  content.appendChild(colWrap);

  drawer.classList.add('open');
}

function bindEvents() {
  const canvasWrap = $('#erd-canvas-wrap');
  if (!canvasWrap) return;

  // Search input
  const searchInput = $('#erd-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderCanvas();
    });
  }

  // Zoom controls
  $('#erd-zoom-in')?.addEventListener('click', () => {
    state.zoom = Math.min(state.zoom + 0.15, 2.0);
    renderCanvas();
  });

  $('#erd-zoom-out')?.addEventListener('click', () => {
    state.zoom = Math.max(state.zoom - 0.15, 0.4);
    renderCanvas();
  });

  $('#erd-zoom-reset')?.addEventListener('click', () => {
    state.zoom = 0.9;
    state.panX = 40;
    state.panY = 30;
    state.pinnedNode = null;
    renderCanvas();
  });

  // Pan / Drag
  canvasWrap.addEventListener('mousedown', (e) => {
    if (e.target.closest('.svg-table-node') || e.target.closest('.svg-rel-link') || e.target.closest('#erd-drawer')) return;
    state.isDragging = true;
    state.dragStartX = e.clientX - state.panX;
    state.dragStartY = e.clientY - state.panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    state.panX = e.clientX - state.dragStartX;
    state.panY = e.clientY - state.dragStartY;
    renderCanvas();
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
  });

  // Drawer Close
  $('#erd-drawer-close')?.addEventListener('click', () => {
    $('#erd-drawer')?.classList.remove('open');
    state.pinnedNode = null;
    renderCanvas();
  });
}
