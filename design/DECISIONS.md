# Design decisions log

> Part of the [design governance](README.md). Every rule that could reasonably have gone another
> way is recorded here with its reason, so nobody re-argues it and anyone can propose changing
> it properly. **To change a decision:** add a new entry that supersedes the old one (never edit
> history), update the rule file, and get the owner's OK for anything visible.

| Id | Date | Decision | Why | Alternatives rejected |
|---|---|---|---|---|
| DD-001 | 2026-10-30 | **IBM Plex Sans + IBM Plex Mono** everywhere; no other fonts, no italics for headings. | Owner did not want the current fonts. One family designed for technical UIs, matching mono, clear digits, tabular numbers, free, readable both for dense tables and long notes, so the dashboard and the reading site can share it. | Inter (current body; owner unhappy), Space Grotesk (headings, site body), Instrument Serif italic (site headings — hard to read). |
| DD-002 | 2026-10-30 | **Five semantic colours, one meaning each:** good, bad, warn, accent, neutral. Rose/emerald/teal/orange variants are not separate meanings. | Owner: tiles "use blue and green and red", nothing consistent; the code had two reds (`rose-400`, `red-400`) both meaning bad. | Keeping Tailwind hue classes with a light-mode remap (that remap is why light mode is broken). |
| DD-003 | 2026-10-30 | **Direction is not an outcome:** long/short shown as glyph + word (▲ LONG / ▼ SHORT) in text colour; only results (P&L, R, win/loss) use good/bad. **Open for owner review.** | A profitable short drawn red reads as a loss; colour must keep one meaning (DD-002). | Long = green / short = red, as the 2026-10-30 chart and many trading platforms do (insights R9). If the owner prefers that convention, supersede this with a dedicated pair of direction tokens that differ from good/bad. |
| DD-004 | 2026-10-30 | **Time: one shared parser, zone-less = UTC; screens show UTC labelled (`01:07 UTC`), local time in the tooltip.** | Zone-less timestamps parsed as local put every trade 3 h off. FX sessions, logs and the ledger are UTC; a label removes ambiguity. | Local time on screens (first draft of the rule book). |
| DD-005 | 2026-10-30 | **11 px type floor**; 9/10 px and arbitrary `text-[Npx]` banned. | The app already enforced 11 px (M-00 contract); the chart broke it 35 times. | 12 px floor (first draft) — would churn every existing view. |
| DD-006 | 2026-10-30 | **Radius from one token, `--radius: 10px`.** | The app's existing token (`index.css`); the chart mostly used raw 4 px `rounded`. | 12 px (first draft). |
| DD-007 | 2026-10-30 | **The UI is read-only for orders.** State-changing controls are limited to guarded fix actions (resume/pause, restart a service, rerun a job, reconcile) and the control panel's owner-triggered emergency close. Never open or enlarge a position. | Standing invariant (owner decisions 2026-10-16, 2026-10-18) + the owner's wish to fix things from the screen. | |
| DD-008 | 2026-10-30 | **Chart indicators have their own tokens and never reuse a semantic hue.** | Cyan meant EMA 20 *and* selected; amber meant EMA 50 *and* warning; violet meant four things. | |
| DD-009 | 2026-10-30 | **One money formatter:** `−33.90 CAD` / `+124.33 CAD`, true minus, sign always, code after. | Four formats in one modal (`$-33.90`, `−$34`, `−33.90 CAD`, `+$x.xx`). | |
| DD-010 | 2026-10-30 | **Lightweight Charts, not the TradingView Charting Library.** | Licence, weight, and it fights the read-only and honesty rules. | |
| DD-011 | 2026-10-30 | **Governance is a folder** (`design/` on this site) with an index, foundations, behaviour rules, definition of done, this log, a backlog and the evidence it came from. Every repo's agent instructions point here. | Owner: "we need to maintain good governance and design principle and good consistency". One place; versioned; public. | Rules scattered across repos and briefs. |
