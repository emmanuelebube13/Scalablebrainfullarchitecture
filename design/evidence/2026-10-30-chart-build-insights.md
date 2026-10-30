# Design governance: insights from the chart build (2026-10-30)

**For:** the agent building ScalableBrain's design governance.
**From:** the engineer who built and shipped the asset-chart upgrade, then found and fixed its bugs in production the same day.
**Companion file:** `docs/CHART-DESIGN-AUDIT-2026-10-30.md` is a line-by-line accessibility and design audit of the chart, written by a separate review agent. This file is different. It records **what went wrong in practice and why**, turned into rules a governance system should enforce.

Every rule below comes from a real defect that reached the owner's screen. Each one is tagged *(evidence: …)*.

---

## 1. The core lesson

The chart looked finished in screenshots. Agents wrote it and agents reviewed it, and still the owner found within minutes that **"you cannot click anything"**. Every failure below was invisible to code review and obvious to a human using the page. So governance must define **"done" as verified by using the UI**, not as "it builds", "tests pass" or "it looks right in a static screenshot".

---

## 2. Rules, with the defect that motivated each

### R1. Use the component library. Never hand-roll overlays.
`src/components/ui/` already has `dropdown-menu`, `popover`, `tooltip`, `sheet`, `select`, `scroll-area`, `dialog` and `sonner` (toasts). They are Radix-based, render through portals, and handle focus, Escape and outside clicks. The chart ignored them and hand-built its menus.

*(Evidence: the Indicators and Layers dropdowns were absolutely positioned inside an `overflow-x-auto` row. A container that scrolls horizontally also clips vertically, so the menus opened inside the 36 px toolbar and were invisible. Shipped to prod, found by the owner. Fixed 2026-10-30 by moving them out of the scroller. The proper fix is the library `DropdownMenu`.)*

- **Rule:** any floating surface (menu, popover, tooltip, toast, sheet) must use the `ui/` primitive. A lint or grep check should flag `absolute top-full` and hand-rolled `mousedown` outside-click handlers in feature code.
- **Corollary:** never put a popover trigger inside an `overflow-*` container unless the popover is portalled.

### R2. Every control must do something, provably.
*(Evidence: the "R:R Boxes" layer toggle shipped with nothing reading it. It ticked and unticked and the chart never changed.)*

- **Rule:** each toggle, menu item and button needs one of:
  - a unit test asserting its effect, or
  - a row in the component's "interaction contract" table (control → state it changes → visible effect).
- **Rule:** dead controls fail review. A greyed-out control is acceptable only with a tooltip saying why.

### R3. No fabricated numbers. Absent renders as absent.
This is the project's oldest principle (`CLAUDE.md` §9), and the UI layer broke it three ways in one day:
- The TradeCard showed **"Backtest 58.5% win, +0.85R, Walk-forward validated"** for every strategy. These were hard-coded fallbacks (`?? 58.5`), and no backtest record existed.
- Closed trades with unknown P&L were drawn with a **red "loss" dot** (`(realized ?? 0) > 0`).
- The strategy "last 10" string counted unknown P&L as **L**.

Rules:
- `?? <number>`, `|| 0` and `?? 0.5` are banned in display code for any business metric. A missing value renders `—` plus a reason ("no backtest record").
- Colour or icon must never encode an outcome that isn't known. Unknown gets its own neutral glyph (`◆`, grey).

### R4. Every number states its grain and its sample size.
*(Evidence:*
- *The side panel showed "xard_ma_cross: Closed 0, Mean R −0.18R, WLLL". "Closed" was per-pair while mean R and last-10 were all-pairs, and nothing said so.*
- *The card's "Live Record" was all-pairs while the panel above it was per-pair.)*

Rules:
- Any aggregate (win rate, mean R, P&L) is labelled with its scope (this pair / all pairs / this month) and its `n`.
- Rates with `n < 20` render muted, with a "too few trades to judge" tooltip.
- Use muted styling, not strikethrough. A struck-through number reads as "wrong", not "uncertain".

### R5. Data contracts are part of the design.
*(Evidence: the new chart read `model.payloads.positions`, a shape that doesn't exist. The real fields are `model.positions` and `model.regime`. Result: **open trades never appeared on the chart**, the one thing the redesign was for. It also read realised P&L from `realizedPnl`/`grossPnl` when the API sends `pnl`.)*

Rules:
- Each view documents its inputs in a typed interface that matches the real producer (`connection.js` mappers, the `Trade` pydantic model).
- Each view ships with a fixture taken from **real API output**, not invented shapes.
- Governance check: "Does the screenshot show the feature's primary content populated from real data?" An empty state is not a pass.

### R6. Time is UTC, explicitly, everywhere.
*(Evidence: ledger timestamps arrive without a zone, e.g. `2026-10-27T05:18:55`. Browsers parse those as **local** time, so every trade was placed 3 hours off on the chart.)*

Rules:
- One shared parser (`toUnixSeconds`) for every timestamp, and it treats zone-less values as UTC.
- Every displayed time carries `Z` or "UTC".
- Never call `new Date(string)` in a view.

### R7. Canvas content needs a text twin.
Price charts draw on canvas, so screen readers, copy-paste and search see nothing.

Rules:
- Every fact drawn on the canvas also appears as text: trade levels in the card, results in the list, regime in the header.
- Price changes and toasts use polite `aria-live` regions, throttled (no more than one announcement every few seconds).

### R8. One type scale, with a floor of 11 px for anything a user must read.
*(Evidence: the chart folder alone uses `text-[11px]` ×30, `text-[10px]` ×26 and `text-[9px]` ×9, plus 30 distinct hard-coded hex colours. That is three near-identical sizes with no semantic difference.)*

Rules:
- Define named tokens: `--text-micro` (11 px, labels only), `--text-body-sm` (12 px), `--text-body` (13 or 14 px), `--text-figure` (tabular mono for numbers).
- Arbitrary `text-[Npx]` is a lint warning.
- 9 px is banned. 10 px is allowed only for non-essential captions, at 4.5:1 contrast or better.
- All colours come from tokens:
  - `--chart-up`, `--chart-down`
  - `--chart-accent-1..6`
  - `--chart-ema-fast`, `--chart-ema-slow`, `--chart-band`
  - semantic `--success`, `--danger`, `--warning`, `--info`
- Charting code reads them from `chartTheme.ts`. Grep for `#[0-9a-f]{6}` in `components/` should return only token definitions.

### R9. Never use colour alone for direction, outcome or status.
The chart does this right in places and wrong in others. Codify it:

| Meaning | Glyph | Sign | Colour |
|---|---|---|---|
| Long | ▲ | | green |
| Short | ▼ | | red |
| Direction unknown | ◆ | | grey |
| Win | | + | green |
| Loss | | − | red |
| Healthy | ● | | + label "healthy" |
| Degraded | ● | | + label "degraded" |

Status dots always carry a text label, or `sr-only` text at minimum.

### R10. Interaction states are mandatory, not decoration.
Every interactive element has:
- hover
- `focus-visible` ring (2 px, `--ring`)
- pressed/selected state expressed with `aria-pressed`, `aria-checked` or `aria-selected`
- disabled state with a reason

Toggle groups use `role="group"` plus `aria-pressed`. Menus use `role="menu"` / `menuitemcheckbox`, with arrow-key navigation.

*(Evidence: the timeframe and chart-type buttons and the menu items had no ARIA state and no focus ring until the 2026-10-30 fix.)*

### R11. Escape and keyboard shortcuts work in layers.
*(Evidence: the chart closed on Escape even when a menu was open, so pressing Esc to dismiss a menu threw away the whole chart.)*

Rules:
- Escape closes the **innermost** layer only: menu → card → replay → modal.
- Global single-key shortcuts (1–8, T, F, [ ]) are disabled while a text field, menu or replay has focus.
- Every shortcut is listed in a `?` help panel.

### R12. Affordance has to be honest.
The owner's words were "you cannot click anything, everything is fixed". Two failure modes:
- **Looks clickable but isn't:** chevrons that don't open, rows with hover styles that do nothing.
- **Is clickable but looks static:** chart boxes and tags you can click to select a trade, with no cursor change or hint.

Rules:
- A chevron means a disclosure, so it must open something.
- Clickable canvas objects show a pointer cursor and a hover outline.
- Every panel row that is a list of things should be clickable to drill in. For example, a strategy row should filter the chart and the closed list to that strategy. Today it is static.

### R13. Density pattern for lists that grow.
*(Evidence: "Recent closed" was 10 tall boxes, about 340 px, pushing everything below it off screen.)*

Standard pattern for a side-panel list:
1. a one-line summary (counts and net)
2. 5 compact rows, 28 px tall, one line, with fixed-width numeric columns
3. "Show all N", which expands inside a bounded scroll area (`max-h-64`)

Use the same pattern everywhere: Overview, Trades, Signals.

### R14. Vertical budget for chart pages.
The chart competes with chrome for height. On a 900 px laptop, the original design spent about 35 % of the height on four stacked bars.

Rules:
- At most two fixed bars above a chart: a header row of about 44 px and a toolbar of about 36 px.
- Everything else (system status, regime grid, diagnostics) goes in disclosures or the side panel.
- HUDs float on the canvas, with no background or a translucent one.

### R15. Shareable output is a designed artefact.
The owner wants to screenshot trades and send them to people. A raw canvas capture loses the context (pair, strategy, result, dates).

- **Rule:** any "export image" frames the capture with a header (what, when, result) and a footer (key levels, data source, UTC).
- This exists now in `chartSnapshot.ts`. Make it the standard for every exportable chart (Performance view, equity curve).

### R16. Read-only is a feature. Say so visibly.
Standing invariant: the dashboard never places, changes or closes orders, except the owner-triggered emergency flatten in the control panel.

Design rules:
- No drag handles on SL/TP lines, and nothing that looks like a trade ticket.
- Action-looking elements (Replay, Snapshot) use neutral or primary styling, never buy/sell colours.
- A small "Read-only chart" note is acceptable and reassuring.

---

## 3. Definition of done for any UI change (proposed)

A change is not done until **all** of these are attached to it:

1. **Real-data screenshot** at 1440×900 *and* at 390 px wide, in dark *and* light theme, with the feature's primary content populated.
2. **Interaction run** (scripted headless browser; a CDP script exists, see below):
   - every new control clicked
   - its visible effect asserted
   - every popover asserted fully on-screen (`elementFromPoint` inside the popover)
   - no page errors in the console
3. **Keyboard pass:** reach every control by Tab, operate it with Enter/Space/arrows, close it with Esc in the right layer.
4. **Honesty pass:** grep the diff for `?? <number>`, `|| 0` and hard-coded percentages. Every number has a source, a scope and an `n`.
5. **Token pass:** no new hex colours and no new arbitrary font sizes outside the token files.
6. **Contrast:** text at 4.5:1 or better (3:1 for text ≥18.66 px bold or ≥24 px). Compute against the actual card background, `#14161C` in dark.

The CDP driver used on 2026-10-30 drove headless Chrome with no extra dependencies: Node 24's built-in `WebSocket`, Chrome on `--remote-debugging-port`. It lived in the session scratchpad. **Recommendation:** promote it to `telemetry-dashboard/scripts/ui-check/` as the project's standard way to verify UI, with one script per view.

---

## 4. What the chart is still missing

The owner said "I feel like there's more that there should be." These are ranked by value to a single operator going live in December, and all of them fit the read-only rule:

1. **Strategy rows as filters.** Clicking a strategy highlights its trades on the chart and filters the closed list.
2. **Click-anywhere trade discovery.** Hovering a past trade's entry marker shows a mini card. Today only the boxes and tags are hit-tested.
3. **Measure tool.** Drag from one point to another to read pips, %, bars and R. This is the most-used tool on any trading chart.
4. **Session shading.** Tokyo, London and New York sessions as faint background bands. FX behaviour depends heavily on the session, and this needs no data.
5. **Regime as a background band** along the time axis, coloured trending or ranging, instead of only a chip.
6. **Replay of open trades so far:** replay from entry to now.
7. **Compare-to-plan on closed trades.** Planned R:R vs achieved R, and MFE/MAE ("went +1.0R then reversed to −0.67R"). The replay already computes these, so surface them in the list.
8. **Alert lines (local only).** A dashed line that notifies when price crosses it. This places no order, so it is allowed, but check with the owner first.
9. **Economic calendar markers.** Only if a free source is acceptable (owner rule: no paid data until profitable).
10. **Light-theme polish.** Light theme is supported but was never screenshot-verified for the chart.

---

## 5. What I would not do

- **Don't adopt the TradingView Charting Library** to "look professional". It needs a licence, it's heavy, and it would fight the read-only and honesty rules. Lightweight Charts plus good tokens is enough.
- **Don't add more colours to signal more meaning.** The chart already uses six accents, plus up/down, plus purple indicators, plus cyan EMA. The next gain comes from fewer colours with labels.
- **Don't make the side panel wider.** Make it smarter (R13) and let the chart have the space.
