# Interaction and honesty rules

> Part of the [design governance](README.md). [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) says how a
> screen must **look**; this file says how it must **behave** and what it may **claim**.
> Every rule here comes from a defect that reached the owner's screen during the asset-chart
> build on 2026-10-30 — see [`evidence/2026-10-30-chart-build-insights.md`](evidence/2026-10-30-chart-build-insights.md)
> (what went wrong and why) and [`evidence/2026-10-30-chart-design-audit.md`](evidence/2026-10-30-chart-design-audit.md)
> (line-by-line audit). Rule ids (H = honesty, I = interaction, L = layout) are stable: cite them in reviews.

The core lesson: the chart looked finished in screenshots, passed agent review, and the owner
found in minutes that "you cannot click anything". **Done means verified by using the UI.**

---

## Honesty — what a screen may claim

| Id | Rule | Evidence |
|---|---|---|
| **H1** | **Absent renders as absent.** `?? <number>`, `\|\| 0`, `?? 0.5` and hard-coded percentages are banned in display code for any business metric. A missing value is `—` plus the reason ("no backtest record"). | TradeCard showed "Backtest 58.5% win, +0.85R" for every strategy from a `?? 58.5` fallback. |
| **H2** | **Never encode an unknown outcome.** Colour or icon may only show an outcome that is known; unknown gets its own neutral glyph (◆, `--neutral`). | Closed trades with unknown P&L drew a red loss dot (`(realized ?? 0) > 0`); "last 10" counted unknown as L. |
| **H3** | **Every aggregate states its scope and its n.** Win rate, mean R, P&L carry "this pair / all pairs / this month" and `n`. With `n < 20` the number is muted with a "too few trades to judge" tooltip — muted, never struck through. | Side panel mixed per-pair "Closed 0" with all-pairs "Mean R −0.18R" with no label. |
| **H4** | **Data contracts are part of the design.** Each view types its inputs to match the real producer (the `connection.js` mappers, the API models) and ships a fixture captured from **real API output**. A screenshot whose primary content is empty is not a pass. | The chart read `model.payloads.positions`, which does not exist: open trades never appeared — the one thing the redesign was for. |
| **H5** | **Time is parsed as UTC, displayed labelled.** One shared parser; zone-less values are UTC; no `new Date(string)` in views (DESIGN-SYSTEM §8, DD-004). | Every trade sat 3 h off on the chart. |
| **H6** | **Canvas content has a text twin.** Every fact drawn on a canvas also appears as text (levels in the card, results in the list, regime in the header); price changes and toasts use polite, throttled `aria-live`. | Charts are invisible to screen readers, copy-paste and search. |
| **H7** | **Read-only is visible.** The dashboard never places or modifies orders. No drag handles on SL/TP, nothing that looks like an order ticket, no buy/sell colours on action buttons (Replay, Snapshot). The only state-changing controls are the guarded fix actions and the control panel's owner-triggered emergency close (DD-007). | Standing invariant; owner decision 2026-10-16. |

## Interaction — every control works, provably

| Id | Rule | Evidence |
|---|---|---|
| **I1** | **Use the component library; never hand-roll floating surfaces.** Menus, popovers, tooltips, selects, sheets, dialogs, toasts come from `src/components/ui/` (Radix, portalled). Never put a popover trigger inside an `overflow-*` container unless the popover is portalled. Lint flags `absolute top-full` and hand-written outside-click handlers in feature code. | Indicators/Layers menus opened inside a 36 px scrolling toolbar and were invisible — shipped to prod. |
| **I2** | **Build a control once.** Segmented toggle (`toggle-group`), ghost button (`ui/button` variant), badge, toast, money formatter: one component each, reused. | The chart hand-built the segmented toggle 3× with 3 selected styles, the popover 4×, the toast 2×, money formatting 4 different ways. |
| **I3** | **Every control does something.** Each toggle, menu item and button has a unit test asserting its effect, or a row in the view's interaction contract (control → state → visible effect). Dead controls fail review; a disabled control says why. | The "R:R Boxes" toggle was wired to nothing. |
| **I4** | **Interaction states are mandatory:** hover; 2 px `focus-visible` ring in `--accent`; selected/pressed expressed with `aria-pressed` / `aria-checked` / `aria-selected`; disabled with a reason. Toggle groups `role="group"`; menus `role="menu"` with arrow keys. | Timeframe and chart-type buttons had no ARIA state and no focus ring. |
| **I5** | **Escape and shortcuts work in layers.** Esc closes the innermost layer only (menu → card → replay → modal). Single-key shortcuts are off while a text field, menu or replay has focus. Every shortcut is listed in a `?` panel. | Esc to close a menu threw away the whole chart. |
| **I6** | **Affordance is honest.** A chevron opens something. Hover styles only on things that react. Clickable canvas objects show a pointer cursor and a hover outline. A row in a list of things drills in. | "You cannot click anything, everything is fixed." |
| **I7** | **Every red state offers its fix** (DESIGN-SYSTEM rule 6): what is wrong in plain words, plus the button or exact step. | Owner, 2026-10-30: fix it from the screen, not by asking someone. |

## Layout — space is a budget

| Id | Rule | Evidence |
|---|---|---|
| **L1** | **Growing lists:** one summary line (counts, net) → 5 compact 28 px rows with fixed-width number columns → "Show all N" expanding inside a bounded scroll area. Same pattern in Overview, Trades, Signals and side panels. | "Recent closed" was 10 tall boxes (~340 px) pushing everything off screen. |
| **L2** | **Chart pages:** at most two fixed bars above a chart (header ~44 px, toolbar ~36 px). Status, regime grid and diagnostics go into disclosures or the side panel. HUDs float on the canvas. | Four stacked bars took ~35 % of a 900 px laptop's height. |
| **L3** | **Make panels smarter, not wider.** Density (L1) before width. | |
| **L4** | **Shareable output is designed.** Any "export image" frames the capture with a header (what, when, result) and a footer (key levels, data source, UTC) — the `chartSnapshot.ts` pattern is the standard for every exportable chart. | The owner screenshots trades to send to people. |

## What we deliberately do not do

- No TradingView Charting Library to "look professional": licence, weight, and it fights H7 and
  H1. Lightweight Charts plus good tokens is enough (DD-010).
- No new colours to carry more meaning. Fewer colours, with labels.
- No fixing an accessibility or consistency finding by hiding the control.
