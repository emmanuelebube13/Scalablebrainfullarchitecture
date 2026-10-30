# Asset chart: design and accessibility audit (2026-10-30)

Scope: `telemetry-dashboard/src/components/assets/*` (modal, panel, header, toolbar, side panel, HUD, trade card, replay, theme, snapshot, overlay primitive), plus `src/index.css`, `tailwind.config.js`, `src/components/ui/*`, and `views/Performance.tsx` / `views/Overview.tsx` for comparison.

Constraints honoured: the chart stays read-only (no orders, no drag-to-move SL/TP, no close buttons). Missing data renders as "—", never as a default number. One operator. Dark theme first, light theme supported. Desktop and phone (390px).

**About the evidence**
- **[V] Verified**: I read the code at the cited line.
- **[S] Seen in a screenshot**: `shots-prod/1..5` (desktop, about 1480px) or the owner's `C:\SB\image copy.png`.
- **[I] Inferred**: worked out from the code, but it needs a check in the running app.
- Line numbers are from the uncommitted working tree as I read it on 2026-10-30. The tree was changing while I read it. `AssetChartPanel.tsx` gained one line near line 800, so its references after line 800 use the current numbering.
- `ChartToolbar.tsx` was being rewritten while I audited it, for the dropdown fix. Refs marked **[HEAD]** point to commit `9e4696d`. Refs marked **[pre-fix]** point to the copy I read first. Refs marked **[wip]** point to the rewrite in progress.

---

## 0. Why the Indicators and Layers dropdowns don't open

**Cause [V]:** each menu panel was positioned `absolute top-full` inside the left toolbar group. That group carries `overflow-x-auto` (**[HEAD]** `ChartToolbar.tsx:77`; **[pre-fix]** `:141`, with panels at `:200-201` and `:252-253`). When `overflow-x` is set to anything other than `visible`, the browser forces `overflow-y` to `auto` as well. So the panel opened inside a 36px-tall scroll box (`h-9`, `:139`) and was clipped to nothing. The owner's screenshot shows the side effect: a stray scrollbar and scroll arrow appear under the toolbar at about (654, 82) when a menu is "opened" [S]. The trigger's chevron also never rotated, so there was no sign that anything had happened.

**Fix in progress [V, wip]:** the menus have moved outside the scroller (`ChartToolbar.tsx:78-83` explains why), and they now use `role="menu"`, `menuitemcheckbox`, arrow-key navigation and Escape handling that doesn't close the chart (`:210-230`). Three problems remain:
- (a) Both menus are still hand-written, although `@radix-ui/react-dropdown-menu` is installed and wrapped in `ui/dropdown-menu.tsx:32-48`. That wrapper renders through a Portal, so no `overflow` ancestor can clip it.
- (b) The panels are `w-60 absolute left-0` (`ChartToolbar.tsx` wip `:306`). At 390px, the Layers trigger sits at about x=170, so a 240px panel runs past the right edge of the viewport. `DialogContent` has `overflow-hidden` (`AssetChartModal.tsx:37`), so the overflowing part is clipped [I].
- (c) Outside-click dismissal listens to `mousedown` only (wip `:221`). Use `pointerdown` so touch dismisses reliably.

---

## 1. Interaction and affordance failures

Severity: **H** = blocks a task or misleads; **M** = friction; **L** = polish.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| 1.1 | H | **The side panel is always 320px wide, at every viewport width.** At 390px that leaves about 70px for the chart. The floating controls, which are about 260px wide (`right-16`), and the 320px trade card are then clipped by `overflow-hidden`. On a phone the chart is unusable. | [V] `ChartSidePanel.tsx:155` (`w-80`, no breakpoint); `AssetChartPanel.tsx:901-997` (no responsive branch; no `sm:`/`md:` anywhere in the side panel or panel); [I] rendering at 390px |
| 1.2 | H | **Scrolling back through history never loads older candles.** The chart-creation effect captures `hasMore` once, when the chart mounts. At that moment `hasMoreRef.current` is still `false`, and the effect re-runs only when the instrument changes. So `range.from < 20 && hasMore` is always false. Panning left stops at the first page, and the user is told "older than the loaded history, use ▶ Replay". This probably feeds the owner's "everything is fixed". | [V] `AssetChartPanel.tsx:395-400`, deps `:446`; `useCandles.ts:71,292` (`hasMore: hasMoreRef.current` is a value copied at render time) |
| 1.3 | H | **The OHLC readout can't be reached while trades are open.** Line 3 of the HUD shows only when `(isHovered \|\| !hasTrades) && hoveredBar`. `hoveredBar` is set only while the crosshair is over the canvas. Moving the pointer onto the HUD (an HTML layer above the canvas) ends the crosshair, so `hoveredBar` becomes null. Both conditions can never be true together. | [V] `PositionHud.tsx:132` (the "Line 3" block), `:79-80`; `AssetChartPanel.tsx:403-410` |
| 1.4 | H | **Esc doesn't deselect first; it closes the whole chart [I, high confidence].** Radix Dialog handles Escape on `document` during the capture phase, which runs before the panel's `window` listener during bubbling. The help text promises "Esc: Deselect / Close". The fix in progress handles this only for the toolbar popovers. | [V] `AssetChartPanel.tsx:799-807,810`; `AssetChartModal.tsx:33`; help text `ChartToolbar.tsx` wip `:193` |
| 1.5 | H | **Open-trade cards and closed-trade rows can't be reached by keyboard.** They are `<div onClick>` with no `role`, no `tabIndex` and no key handler. The only keyboard way to select a trade is `T`, which covers open trades only and doesn't scroll to them. | [V] `ChartSidePanel.tsx:171-179` (open), `:90-97` (closed); `AssetChartPanel.tsx:781-789` (`T` calls `setSelectedTradeKey`, not `selectTrade`) |
| 1.6 | H | **"Open trade forensics" never appears.** The modal never passes `onOpenTradeForensics`, so the link is skipped. Trade IDs (`#2845`) are plain text everywhere in the chart. There's no way to jump to the trade's detail in the Trades view, although `TradeDetail.tsx:217` links the other way, into the chart. | [V] `AssetChartModal.tsx:49-58` (prop absent); `TradeCard.tsx:324-331`; `TradeCard.tsx:110` |
| 1.7 | M | **The trade card covers the trade it describes.** The card is 320px wide, pinned top-left (`top-16 left-3`). Trades start on the left of a fitted view, so the card hides the entry and the left half of the R:R box. | [V] `AssetChartPanel.tsx:918`; [S] `2-closed-selected.png` (card hides entry candles from 26 to 27) |
| 1.8 | M | **The floating Fit/Now/Reset/Snapshot bar sits on the time axis.** It hides the date labels ("30" is missing in shot 1) and covers the most recent volume bars. | [V] `AssetChartPanel.tsx:936` (`absolute bottom-3 right-16`); [S] `1-live-chart.png`, `2-closed-selected.png` |
| 1.9 | M | **Trades on the canvas show a pointer cursor but no hover feedback.** `hitTest` returns `cursorStyle:'pointer'`, but there's no tooltip and no highlight. A click anywhere inside an open trade's SL to TP band, from entry to the right edge (often most of the pane), selects it. A click anywhere else deselects it. Clicking candles therefore does surprising things. | [V] `TradeOverlayPrimitive.ts:450-484`; `AssetChartPanel.tsx:413-423` |
| 1.10 | M | **Signal dots have no labels and can't be inspected.** The text is `''` and there's no hover readout, so the "Signal Dots" layer is unreadable. Closed-trade entry arrows are also unlabelled grey. | [V] `AssetChartPanel.tsx:630-637` (`text: ''`), `:646-653` |
| 1.11 | M | **The symbol picker isn't a real combobox.** It has no `role="combobox"` or `listbox`, no arrow keys, and Enter doesn't pick the first match. Esc goes to the Dialog and closes the chart (see 1.4). The search input sets `outline-none`, so it has no focus indicator. | [V] `ChartHeader.tsx:449-488`, `:466` |
| 1.12 | M | **The toolbar stays live during replay, but it no longer controls what's on screen.** Timeframe, Indicators and Layers change the hidden live chart behind the replay. The replay draws no EMA or other indicators. | [V] `ReplayView.tsx:307` (overlay `absolute inset-0` inside the chart area only); `AssetChartPanel.tsx:871-883` |
| 1.13 | M | **Space is captured globally during replay**, in the window capture phase. A keyboard user who focuses "Copy image" or "Save PNG" and presses Space toggles playback instead of pressing the button. | [V] `ReplayView.tsx:244-254` |
| 1.14 | M | **The whole chart has `select-none`.** You can't select or copy a price, trade ID or strategy name from the header, HUD, card or side panel. | [V] `AssetChartPanel.tsx:854`; `ChartHeader.tsx:444`; `ChartSidePanel.tsx:155`; `PositionHud.tsx:79` |
| 1.15 | L | **Important explanations live only in `title=`.** Examples are "too few trades to judge", column meanings, "Last 10 results", and the feed-health meaning. None of these can be reached by touch or keyboard. | [V] `ChartSidePanel.tsx:24,32,231-235`; `ChartHeader.tsx:546` |
| 1.16 | L | **Toggles give no pressed/active state to assistive tech or touch.** The speed buttons have no `aria-pressed`, and the selected speed (`bg-card` on `bg-muted/30`) is barely visible. In the old toolbar, the timeframe and chart-type buttons also lacked `aria-pressed`; the work in progress adds it. | [V] `ReplayView.tsx:417-428`; [S] `3-replay-start.png` ("2x" is hard to tell apart) |
| 1.17 | L | **The Provenance popover has no outside-click or Escape dismissal, and no `aria-expanded`.** | [V] `ChartSidePanel.tsx:316-333` |

---

## 2. Accessibility (WCAG 2.2 AA)

### 2.1 Keyboard and focus
- **2.1.1 Keyboard (fail).** See 1.5 (trade rows), 1.9 (overlay selection by mouse only) and 1.11 (combobox).
- **2.1.4 Character Key Shortcuts (fail).** `1`–`8`, `[`, `]`, `T` and `F` are single-character shortcuts bound to `window` with no way to turn them off. The help popup even says "Chart Focus", which isn't how the code behaves. [V] `AssetChartPanel.tsx:749-811`; `ChartToolbar.tsx` wip `:185`. Fix: bind them to the chart region (`tabIndex=0` container, `onKeyDown`) or add an off switch.
- **2.4.3 Focus Order.** Mostly fine because Radix Dialog traps focus. The trade card, however, is inserted *before* the canvas in the DOM but appears visually inside the chart. After selecting a trade, focus stays wherever the click happened and doesn't move to the card. [V] `AssetChartPanel.tsx:916-930`.
- **2.4.7 / 2.4.11 Focus Visible and Not Obscured (partial).** Only the toolbar in progress has `focus-visible:ring`. These files have **0** focus styles: `ChartHeader.tsx`, `ChartSidePanel.tsx`, `TradeCard.tsx`, `ReplayView.tsx`, `PositionHud.tsx` [V]. They fall back to the browser's default outline, which looks different from the rest of the chart. The symbol search sets `outline-none` (`ChartHeader.tsx:466`), so it has no indicator at all.

### 2.2 Roles and names (4.1.2)
| Control | Problem | Evidence |
|---|---|---|
| Symbol trigger | No `aria-haspopup`, `aria-expanded` or accessible role for the popup list | [V] `ChartHeader.tsx:449-455` |
| Close chart (X) | Has only `title`, no `aria-label`. `title` is not a reliable accessible name. | [V] `ChartHeader.tsx:552-558` |
| Trade card close (X) | Same problem | [V] `TradeCard.tsx:115-121` |
| Floating Fit/Now/Reset | Visible text is fine. The tooltips state shortcuts (F) that are only in `title`. | [V] `AssetChartPanel.tsx:937-965` |
| Diagnostics disclosure | No `aria-expanded` or `aria-controls` | [V] `ChartSidePanel.tsx:269-277` |
| Show all / Show fewer | No `aria-expanded` | [V] `ChartSidePanel.tsx:126-132` |
| Section titles | `<span>`/`<div>`, not headings. Performance.tsx uses `<h2>`/`<h3>` (`Performance.tsx:96,170`), so screen-reader navigation by heading doesn't work in the chart. | [V] `ChartSidePanel.tsx:158-160,222,70` |
| Count badges | In the old toolbar, the "2" and "3" badges were bare numbers. The work in progress adds `aria-label="N on"`. | [V] wip `:297` |
| Replay | Good: icon buttons have `aria-label`, `<label>` for the select, `aria-label` on the range (`ReplayView.tsx:322,340,394-416`). Use this as the model for the rest. | [V] |

### 2.3 Canvas content (1.1.1, 1.3.1)
- The chart container is a bare `<div ref>` with no `role="img"`, no `aria-label` and no text alternative [V] `AssetChartPanel.tsx:933`, `ReplayView.tsx:348`. The side panel covers the trade list in text, but nothing describes the current price, the visible range, the selected trade's levels as drawn, or the signal markers. Recommendation: give the container `role="img"` and an `aria-label` built from data already computed, for example "EUR/USD 1H, last 1.12036, 2 open trades, nearest stop −18.3p". Treat the side panel and trade card as the full text equivalent, which means fixing 1.5.
- Overlay tags, SL/TP axis labels and R:R boxes exist only on the canvas [V] `TradeOverlayPrimitive.ts:148-203,403-429`. The trade card repeats them in text when a trade is selected, which is fine.

### 2.4 Live regions (4.1.3 Status Messages)
- **The toasts aren't announced.** "Image copied", "#X is older than the loaded history…" and "browser blocked the clipboard" are plain `<div>`s with no `role="status"` or `aria-live` [V] `AssetChartPanel.tsx:968-972`; `ReplayView.tsx:387-389`. The rest of the app already does this correctly: `NotificationBell.tsx:477-478` and `TopBar.tsx:125`. The toasts also disappear after 2.6s regardless of hover (`AssetChartPanel.tsx:277`), which runs into 2.2.1.
- **Feed state changes aren't announced.** LIVE, FEED, STALLED and MARKET CLOSED change silently [V] `ChartHeader.tsx:414-432,544-549`. Announce *state transitions* politely. **Do not** announce every price tick.

### 2.5 Contrast (1.4.3)

I computed these with the WCAG formula, blending alpha over the actual surface. Script: `scratchpad/audit/contrast.py`. AA requires 4.5:1 for all of the chart's text, which is 9–12px and never counts as "large".

**Systemic bug [V]:** `tailwind.config.js:3` sets `darkMode: ["class"]`, but nothing ever adds a `dark` class. `TopBar.tsx:313` toggles only `light`, and `index.html:2` has no class. **Every `dark:` variant in the chart is dead code.** In dark mode, `text-emerald-600 dark:text-emerald-400` renders as **emerald-600**, and likewise for rose-600 and cyan-600.

| Pair (theme) | Ratio | Where | Result |
|---|---|---|---|
| muted-fg `#A1A7B3` on card `#14161C` (D) | 7.49 | everywhere | pass |
| muted-fg at 60% opacity on card (D) | 3.49 | "Read-only chart" `TradeCard.tsx:332` | **fail** |
| muted-fg under `opacity-50` row (D) | 2.79 | strategies with n=0 on this pair, `ChartSidePanel.tsx:244`; [S] the "xard_ma_cross…" row | **fail** |
| emerald-600 on emerald/15 (D, `dark:` dead) | 3.83 | LONG pill `TradeCard.tsx:102`, LIVE feed badge `ChartHeader.tsx:415,423` | **fail** |
| rose-600 on rose/20 (D, `dark:` dead) | 3.10 | SHORT pill `TradeCard.tsx:104`, LIVE account badge `ChartHeader.tsx:529`, STALLED `:429` | **fail** |
| cyan-600 on cyan/20 (D, `dark:` dead) | 3.50 | old Layers count; "Open trade forensics" link `TradeCard.tsx:327` | **fail** |
| slate-500 on slate/15 (D) | 3.26 | MARKET CLOSED badge `ChartHeader.tsx:419` | **fail** |
| rose-500 on card (D) | 4.92 | losses and SHORT across the chart | pass (barely) |
| White on `#26a69a` TP axis label (D) | 3.00 | `TradeOverlayPrimitive.ts:421-427` | **fail** |
| White on `#ef5350` SL axis label (D) | 3.49 | `:413-419` | **fail** |
| White on trade accents `#38bdf8 #a78bfa #34d399 #f472b6 #fbbf24 #2dd4bf` (D) | 1.67–2.72 | entry axis label `:405-411`; [S] "SHORT #2845" white on violet | **fail (all six)** |
| rose-500 on white (L, *not* in the light remap) | 3.67 | every bare `text-rose-500`: `ChartSidePanel.tsx:34,74,88,98,182,193,255`, `ChartHeader.tsx:514`, `ReplayView.tsx:311,361,368,382` | **fail** |
| emerald-600 on emerald/15 (L, not remapped) | 3.26 | `ChartHeader.tsx:415` | **fail** |
| muted-fg under `opacity-50` (L) | 2.26 | `ChartSidePanel.tsx:244` | **fail** |
| muted-fg `#4F5B6B` on white (L) | 6.91 | — | pass |
| White on light accents and SL/TP (L) | 4.83–7.10 | overlay | pass |

The light remap block in `index.css:75-99` catches `text-rose-4*` but not `text-rose-5*`. It catches `text-emerald-3/4/5*` but not `-6*`. That's why the light theme has gaps.

### 2.6 Target size (2.5.8, minimum 24×24 CSS px or equivalent spacing)
Text-xs line height is 16px. Sizes are estimated from padding plus line height.

| Target | Approx. size | Spacing to neighbour | Result |
|---|---|---|---|
| Timeframe buttons (`px-1.5 py-0.5`, 11px) | ~25×20 | 2px (`gap-0.5`) | **fail** `ChartToolbar.tsx` [pre-fix] `:145-153` / wip `:86-99` |
| Chart-type buttons (10px) | ~40×20 | 2px | **fail** (height) wip `:107-118` |
| Replay speed buttons (10px) | ~22×19 | 0 | **fail** `ReplayView.tsx:419-426` |
| Replay button in closed row (`h-5 w-5`) | 20×20 | row 28px | **fail** `ChartSidePanel.tsx:115` |
| Trade card close (`p-0.5` + 14px icon) | 18×18 | — | **fail** `TradeCard.tsx:117-120` |
| Help (`p-1` + 14px) | 22×22 | 8px | pass via spacing exception |
| Header close (`p-1` + 16px) | 24×24 | — | pass |
| Closed-trade row (`h-7`) | full width × 28 | — | pass |

On a phone, every one of the "fail" rows becomes hard to hit.

### 2.7 Use of colour (1.4.1)
- **Direction and P&L share the same green and red.** In the closed list, a red ▼ (SHORT) sits next to a green +$235 (win), and a green ▲ (LONG) next to a red −$45 [S] `1-live-chart.png`, row 2. The glyph carries the meaning, but the colour reads as "good/bad" and contradicts the P&L. [V] `ChartSidePanel.tsx:98-100` vs `:88,103-107`; same in `ReplayView.tsx:311`. Recommendation: direction gets a neutral colour plus the glyph; green and red mean P&L only.
- **Greying and opacity carry meaning that only `title` explains.** "n<20, don't trust it" is grey text (`ChartSidePanel.tsx:24`). "No trades on this pair" is `opacity-50` (`:244`).
- The **System health dot** was colour-only before the fix. The work in progress adds sr-only "(degraded)/(healthy)" (wip `:160-164`), but sighted users still get only the dot colour.
- **"Last 10" in the trade card is always green**, losses included [V] `TradeCard.tsx:265` (`text-emerald-500` on a whole string like "LWLLLLLLWLL"). [S] `2-closed-selected.png`. This is a misleading encoding. The side panel version does it right (●/○ plus colour, `ChartSidePanel.tsx:30-39`).

### 2.8 Reduced motion (2.3.3, AAA, but worth honouring)
`index.css:337-343` sets animation and transition durations to near zero globally, so `animate-pulse` (old toolbar `:294`), `transition-all` on the progress bar (`TradeCard.tsx:178`) and the spinners are covered [V]. Two things aren't covered: lightweight-charts kinetic scrolling and replay auto-advance. Replay is user-started, so it's acceptable. Consider `kineticScroll: { touch: !reduce, mouse: false }` in `chartTheme.ts:418-457`.

### 2.9 Text spacing and reflow (1.4.10, 1.4.12)
At 320px, the chart needs horizontal room it doesn't have because of the fixed `w-80` side panel (1.1). That fails 1.4.10 Reflow [I].

---

## 3. Design-system consistency

### 3.1 Type scale: the chart breaks the app's own contract
`index.css:190-197` defines **text-nano, text-micro and text-mini, all 11px**. It says "11px minimum at all viewport widths. The harness enforces fs >= 11px… M-00 CONTRACT §3.2". The rest of the app follows this: `Performance.tsx` and `Overview.tsx` use **text-micro 101×, text-mini 22×, text-nano 15×**, and only 5 arbitrary px sizes in total.

The chart files [V] (`grep -o 'text-\[Npx\]'`, as read):
- `text-[9px]` × **9**: badges, table header, footnote, "too few trades". Example: `ChartSidePanel.tsx:187,229,264,294`; `TradeCard.tsx:182,254,263,276`.
- `text-[10px]` × **26**
- `text-[11px]` × **30**
- plus `text-xs` (12px), `text-sm` (14px), and canvas text at 10px (`TradeOverlayPrimitive.ts:173`) and 11px (`chartTheme.ts:426`).

That makes **3 arbitrary sizes, 65 occurrences, 35 of them below the 11px floor**, and **6 distinct sizes** in one 1280px modal. The quickest structural win is to replace `text-[9px]` and `text-[10px]` with `text-nano` and `text-micro`, and `text-[11px]` with `text-mini`, then keep hierarchy through weight and colour.

### 3.2 Colour: tokens vs ad-hoc values
- Tailwind palette colours used directly instead of tokens [V]: emerald-400/500/600 (37), rose-400/500/600 (38), amber-400/500/600 (10), cyan-400/500/600 (3), slate-500 (3), violet-400 (1). The app has semantic tokens (`--semantic-green`, `--semantic-red`, `--semantic-yellow` at `index.css:136-138` and `:28-30`), and Performance.tsx uses them (`Performance.tsx:28-31`). The chart never does.
- Hex and rgba values in TS/TSX outside `chartTheme.ts`: **about 30** [V].
  - Indicator colours `#06b6d4`, `#f59e0b`, `rgba(167,139,250,…)`, `#a78bfa` (`AssetChartPanel.tsx:515,522,530-532,538`)
  - RSI guide colours `#f87171`, `#34d399` (`:546-547`)
  - Volume colours `rgba(38,166,154,.3)` and `rgba(239,83,80,.3)`, the dark values, also used in the light theme (`:577`)
  - Marker greys `#94a3b8` (`:650`; `ReplayView.tsx:210`; `TradeOverlayPrimitive.ts:93`; `tradeModel.ts:216`)
  - Tag background and text `#FFFFFF/#1E2129/#101828/#F3F4F6` (`TradeOverlayPrimitive.ts:192,199`)
  - Axis-label text `#FFFFFF` (`:409,417,425`)
  - Crosshair label `#1e293b/#334155` (`chartTheme.ts:438,444`)
  - Snapshot background `#0F1117`, which isn't a token (`chartSnapshot.ts:516`)
- **Hue collisions [V]:**
  - **Violet means four things:** BB (`:530`), RSI (`:538`), signal dots (`:634`), and trade accent 2 (`chartTheme.ts:394`).
  - **Cyan is the EMA 20 line** (`:515`) **and** the primary/selected colour (`--primary #22D3EE`) **and** trade accent 1.
  - **Amber is EMA 50** (`:522`) **and** the warning colour (`underperforming`, `TradeCard.tsx:232`; degraded dot).
  - The line chart uses `theme.up` green (`AssetChartPanel.tsx:485`), so a falling market shows as a green line.
- `ReplayView` reads the theme once, with `useMemo(getChartTheme, [])` (`ReplayView.tsx:66`), so it ignores light/dark switches. The live panel does listen (`AssetChartPanel.tsx:365-379`).

### 3.3 Surfaces, borders and radius [V counts]
- `border-border` opacity variants: `/30 /40 /50 /60 /80` plus solid, **6 variants**.
- `bg-muted` variants: `/10 /20 /30 /40 /50 /60 /70 /80` plus solid, **9 variants**.
- `bg-card` variants: `/60 /80 /85 /90 /95` plus solid, **6 variants**.
- Radius: `rounded` (42), `rounded-md` (9), `rounded-lg` (2), `rounded-xl` (1), `rounded-sm` (1), `rounded-full` (4). The app's radius token is `--radius: 0.625rem` (`index.css:171`), but most chart controls use Tailwind's fixed `rounded` (4px), so they don't follow it.
- With 9 tints of `muted`, no two panels look the same. Hover states also differ across components: `hover:bg-muted/40`, `/50` and `/60` are all in use (`ChartHeader.tsx:451,479,554`; `AssetChartPanel.tsx:939`).

### 3.4 Icon sizes [V]
Sizes in use: `w-2.5` (10px), `w-3` (12px), `w-3.5` (14px), `w-4` (16px). The same role gets different sizes: the close X is 16px in the header (`ChartHeader.tsx:557`), 14px in the trade card (`TradeCard.tsx:120`) and 16px in replay (`ReplayView.tsx:341`). Suggested scale: 12px inline with 10–11px text, 14px in toolbars, 16px for standalone icon buttons.

### 3.5 Duplicated controls that should be components
- **Segmented toggle** (timeframes, chart type, replay speed): hand-built three times with three different selected styles. `bg-primary` for timeframes, `bg-muted` for chart type, `bg-card shadow-sm` for speed [V] (`ChartToolbar.tsx` wip `:94-96`, `:113-115`; `ReplayView.tsx:423`). `@radix-ui/react-toggle-group` is already a dependency (`package.json:40`) and isn't used.
- **Ghost button**, `px-2 py-1 text-[11px] … text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded`, is copied 4 times (`AssetChartPanel.tsx:939,946,953,961`) and again in `ReplayView.tsx:334,337`. `ui/button.tsx` has `variant="ghost" size="sm"`, but nothing in the chart uses it.
- **Popover**: hand-built 4 times, as symbol picker, help, provenance and the toggle menus (`ChartHeader.tsx:457`, `ChartToolbar.tsx` wip `:180`, `ChartSidePanel.tsx:325`, plus ToggleMenu). Each has its own dismiss logic. `ui/popover.tsx` and `ui/dropdown-menu.tsx` use Radix with a Portal.
- **Badge/pill**: used for feed, account, regime, NO STOP, REPLAY, direction and wire_action, with 7 slightly different paddings (`px-1`, `px-1.5`, `px-2`) and font sizes (9, 10, 11px).
- **Toast**: built twice (`AssetChartPanel.tsx:968`, `ReplayView.tsx:387`). `ui/sonner.tsx` exists.
- **Money and sign formatting**: written separately in every file, with inconsistent results:
  - Trade card and overlay print **`$-33.90`**, with a hyphen after the `$` (`TradeCard.tsx:200,208`; `TradeOverlayPrimitive.ts:157,159`) [S] shot 2.
  - The side panel prints **`−$34`**, with a true minus before the `$` and no cents (`ChartSidePanel.tsx:75,107`).
  - Replay and snapshot print **`−33.90 CAD`** (`ReplayView.tsx:269`).
  - The HUD prints `+$x.xx`, with no currency (`PositionHud.tsx:105`).

  Performance.tsx already has one rule ("a sign is always written on money", `Performance.tsx:34-40`), and `forensicsDisplay.js:16` exports `money()`. Pick one shared formatter.
- **Use of `src/components/ui`:** the chart imports exactly one primitive, `Dialog` (`AssetChartModal.tsx:2`). Button, DropdownMenu, Popover, Tooltip, Select, ScrollArea, Sheet, Skeleton and Sonner all go unused. Note that `ui/dropdown-menu.tsx:43` uses Tailwind v4 syntax (`max-h-(--radix-…)`, `origin-(--…)`). Those classes do nothing on Tailwind 3.4.19 (`package.json:76`). Adopting it is still the right call; fix those two classes when you do.

### 3.6 Other inconsistencies with the rest of the app
- **Empty, loading and failed states.** The app has `ViewState` with `FailedState` and `LoadingSkeleton` (`Performance.tsx:18`). The chart says **"Loading strategy records…" for ever** when the fetch fails or returns `[]` (`ChartSidePanel.tsx:224-225`; the fetch catch sets `[]` at `AssetChartPanel.tsx:358-360`). An absent or failed result should say so.
- **Headings.** The rest of the app uses Space Grotesk for h1–h6 (`index.css:182-184`) with real heading elements. The chart has none.

---

## 4. Information design for a trader

### 4.1 Hierarchy and density: what's wrong now
- **The most important number is small and alone.** The price is `text-sm` mono (`ChartHeader.tsx:492`). There is no change direction, no last-tick flash, and in the screenshots no bid/ask, spread or day change: all three are conditional (`:497,511`) and were absent in every shot [S]. Day change depends on `barChange` returning a pct. If those inputs are genuinely unavailable, "—" placeholders would show the user that the fields exist.
- **Two badges reading "PRACTICE" and "LIVE" sit next to each other** (`ChartHeader.tsx:526-549`) [S]. "LIVE" is the *feed*, but next to "PRACTICE" it reads like the account mode. Worse, `environment` is **hard-coded to `"practice"`** (`AssetChartPanel.tsx:866`), even though the app has an account switcher with a monitor-only live account. Once live data is viewable, the chart will mislabel it. Show the badge from real account state, or show "—".
- **StatusStrip is fed made-up data.** `brokerStatus={{ state: 'connected' }}` is a constant, and the version fallbacks are `'1.0'` (`AssetChartPanel.tsx:890-893`). Missing data is being shown as invented values, which breaks the standing rule.
- **Volume `b.volume || 1`** (`AssetChartPanel.tsx:576`) turns missing volume into 1. It is also OANDA *tick* volume, but the menu calls it "Volume".
- **The HUD repeats what's already shown** when nothing is open: "EUR/USD · No open trades" repeats the header symbol and the "Open Trades (0)" panel (`PositionHud.tsx:124-127`) [S]. It also shows *latest* EMA/RSI values beside *hovered* OHLC (`AssetChartPanel.tsx:911-912`), so the numbers come from different bars. It recomputes `ema()` and `rsi()` over all bars on every crosshair move.
- **The side panel's order is wrong when nothing is open.** "Open Trades (0)" takes the prime spot while the useful list ("Recent closed") is second. Strategies is a dense 9–10px table whose header "R̄" renders as "R" in the screenshot [S]. A 3-line footnote is needed to explain it (`ChartSidePanel.tsx:264`).
- **The trade card is long.** It has 8 stacked blocks: header, 4-up levels, distances, progress, P&L, strategy live vs backtest, actions, footer. The "Strategy Performance" block repeats the side panel's Strategies row. "Read-only chart" (`TradeCard.tsx:332`) is noise, since read-only is already the case everywhere.
- **Snapshot exists in four places under four names:** "Snapshot", which copies (`AssetChartPanel.tsx:959-964`); "Image", which downloads (`TradeCard.tsx:309-317`); and "Copy image" and "Save PNG" in replay (`ReplayView.tsx:334-339`).
- **The overlay tag cuts strategy names to 14 characters** ("precision_swin") [S], via `TradeOverlayPrimitive.ts:153`.
- **Axis labels pile up.** Entry, SL, TP and current price can overlap: in [S] `3-replay-start.png`, "1.11666" overlaps "SHORT #2845". The collision pass at `TradeOverlayPrimitive.ts:435-440` covers only the primitive's own labels, not the series' last-price label.
- **RSI sits in the price pane on its own scale** (`scaleMargins top .7`), overlapping the volume histogram (`top .8`) [V] `AssetChartPanel.tsx:476-478,543-545`. lightweight-charts v5 supports real panes (`addSeries(…, paneIndex)`).

### 4.2 What's missing (realistic for this app, read-only, free data)
1. **A persistent OHLC and indicator legend** at the top-left of the pane, TradingView style: O/H/L/C, change, EMA 20/50 and RSI *for the bar under the crosshair*, falling back to the last bar. This fixes 1.3 and stops the HUD from doing double duty.
2. **A countdown to the candle close** next to the last-price label, for example "1.12036 · 23:14". It uses the timeframe seconds already in `tf.seconds`.
3. **FX session shading or markers** (Sydney, Tokyo, London, New York) and a **weekend gap marker**. These are computed from the clock with no data cost, and they matter for when a strategy fires.
4. **Hover tooltips on trades and signals**, read-only. Show strategy, score, wire_action ("published" or "vetoed") and the reason. The data is already loaded in `pairSignals` (`AssetChartPanel.tsx:626-638`). Today the dots are mute.
5. **A trade event timeline** inside the trade card: opened, SL moved, partial close, closed. Use it only if the journal already stores these; if it doesn't, leave it out.
6. **Exposure in account terms** in the HUD: total risk to stops in CAD and as % of NAV. The fields `upnl`, `units`, `sl` and `entry` exist, and NAV is in the Performance data. If NAV is absent, show "—".
7. **A measure tool** (shift-drag, read-only): pips, bars, time and R between two points. It's standard on pro charts and needs no writes.
8. **A timezone label** on the time axis or header ("UTC"). Replay and snapshot say "Z" (`ReplayView.tsx:30`); the live chart doesn't.
9. **A link to the trade's detail** (fix 1.6) and **next/previous trade buttons** in the trade card, which extend `T` to closed trades.
10. **A crosshair price readout in pips from entry** while a trade is selected.
11. **Regime as a first-class element.** Today the regime chip is `hidden md:inline-flex` (`ChartHeader.tsx:538`) and the grid is buried in the "System" disclosure. A small multi-timeframe regime row (1H/4H/1D) in the side panel would earn its space.

### 4.3 Redundant or low-value items (remove or merge)
- The "PRACTICE" badge in the header (the top bar already shows the account [S]), or else make it real (see 4.1).
- The "System ▾" disclosure carrying invented StatusStrip values. Merge it into the feed badge, which already shows freshness.
- "Read-only chart" in the trade card.
- The HUD's "No open trades" line.
- Three of the four snapshot entry points: keep one menu with "Copy" and "Save".
- The "Lightweight Charts™" footer link. The TradingView logo is already drawn on the canvas [S, bottom-left "TV"]. The licence needs attribution once, and `layout.attributionLogo` already provides it.

---

## 5. Top 15 recommended changes (ranked by impact divided by effort)

| Rank | Change | Impact | Effort | Evidence |
|---|---|---|---|---|
| 1 | **Fix history paging:** read `hasMore` and `loadingOlder` from refs inside the range subscription, or re-subscribe when they change. | H: panning back works and "older than loaded history" stops appearing | XS | `AssetChartPanel.tsx:395-400,446`; `useCandles.ts:292` |
| 2 | **Finish the dropdown fix using `ui/dropdown-menu`** (Radix, Portal, collision-aware) instead of the hand-written `ToggleMenu`. Use `DropdownMenuCheckboxItem` for Indicators and Layers. Fix the v4 classes in the wrapper. | H: menus open, are never clipped, and work by keyboard and on phone | S | wip `ChartToolbar.tsx:233-345`; `ui/dropdown-menu.tsx:32-48,43` |
| 3 | **Make the side panel responsive.** Below `md`, hide it and open it as a `ui/sheet` from a "Trades" button. Below `sm`, show the trade card as a bottom sheet. | H: the chart becomes usable at 390px | S–M | `ChartSidePanel.tsx:155`; `AssetChartPanel.tsx:918,986` |
| 4 | **Stop showing invented values:** real `environment` (or "—"), real broker status (or don't render it), no `'1.0'` versions, no `volume \|\| 1`, and "No strategy records" / "Failed to load" instead of "Loading…" for ever. | H: honours the absent-data rule; prevents the live/practice mislabel | XS | `AssetChartPanel.tsx:576,866,890-893`; `ChartSidePanel.tsx:224-225` |
| 5 | **Replace the HUD's line 3 with a persistent crosshair legend.** OHLC, EMA20/50, BB and RSI *for the hovered bar*, falling back to the last bar. Compute indicators once with `useMemo` and look them up by time. | H: answers the trader's first question on every bar | S | `PositionHud.tsx:132-145`; `AssetChartPanel.tsx:905-914` |
| 6 | **Make trade rows keyboard operable.** Use `<button>` or `role="button" tabIndex=0` with Enter/Space, `aria-pressed` for the selected row, and route `T` through `selectTrade` so it scrolls. | H: 2.1.1 | XS | `ChartSidePanel.tsx:90-97,171-179`; `AssetChartPanel.tsx:781-789` |
| 7 | **Fix the dead `dark:` variants.** Add `dark` to `<html>` when light is off (`TopBar.tsx:313`), or drop the `dark:` pairs and use tokens. Extend the light remap to `text-rose-5*` and `text-emerald-6*`. | H: about 8 contrast failures in both themes fixed at once | XS | `tailwind.config.js:3`; `index.css:75-99`; table §2.5 |
| 8 | **Use readable axis-label text.** Pick the label text colour per background, near-black on light accents, so it reaches ≥4.5:1. Dark TP/SL labels need `#0B0C0F` text or darker fills. | H: SL/TP/entry labels become readable (now 1.67–3.49:1) | XS | `TradeOverlayPrimitive.ts:405-429` |
| 9 | **Move the type scale onto the app contract:** `text-[9px]`/`text-[10px]` become `text-nano`/`text-micro`, and `text-[11px]` becomes `text-mini`. Separate levels with weight and colour, not 1px steps. | M–H: meets the 11px floor and the harness; consistent with other views | S (find and replace, then a visual pass) | §3.1; `index.css:190-197` |
| 10 | **Esc order and scoped shortcuts.** Use Dialog `onEscapeKeyDown`: if a trade is selected or a popover is open, `preventDefault()` and deselect. Bind single-key shortcuts to the focused chart region only, which also makes the help text true. | M–H: 2.1.4; stops accidental closes | S | `AssetChartModal.tsx:33`; `AssetChartPanel.tsx:749-811` |
| 11 | **Dock the trade card.** On desktop, show it at the top of the side panel, replacing the list header while a trade is selected. On phone, use a bottom sheet. Cut it to header, 4 levels, result/progress, and actions. Move the live-vs-backtest block behind a disclosure. Remove "Read-only chart". | M–H: stops it hiding the trade; denser | M | `AssetChartPanel.tsx:917-930`; `TradeCard.tsx:226-296,332` |
| 12 | **Extract shared primitives:** a `SegmentedToggle` on Radix ToggleGroup (timeframes, chart type, speed, with `aria-pressed` and 24px targets), `ui/button` ghost/sm for the floating bar and replay, one `Badge`, `ui/sonner` toasts (gives `aria-live`), and one `money()` formatter with a true minus. | M: consistency, 2.5.8, 4.1.3 and money format in one pass | M | §3.5; `AssetChartPanel.tsx:936-972`; `ReplayView.tsx:334-339,387,417-428`; `TradeCard.tsx:200,208`; `TradeOverlayPrimitive.ts:157-159` |
| 13 | **Fix the colour semantics.** Direction gets a neutral colour plus ▲/▼. Green/red mean P&L only. Indicators get their own chart tokens (`--chart-ind-ema20`, etc.), separate from primary, warning and trade accents. The line chart uses foreground. "Last 10" uses per-result colour. | M: removes conflicting signals; 1.4.1 | S | `ChartSidePanel.tsx:98`; `AssetChartPanel.tsx:485,515-547,577,634`; `TradeCard.tsx:265` |
| 14 | **Hover tooltips for overlay trades and signal markers.** A small HTML tooltip positioned from `subscribeCrosshairMove` plus `findTradeAt` and marker hit-tests. Show strategy, score, published/vetoed, entry/SL/TP and P&L. Use one "Click to select" hint. | M: the "I feel there's more there should be" gap; makes the layers worth turning on | M | `TradeOverlayPrimitive.ts:450-484`; `AssetChartPanel.tsx:403-423,626-638` |
| 15 | **Use proper panes and clear the axis.** Put RSI (and optionally volume) in v5 panes (`paneIndex`). Move the Fit/Now/Reset/Snapshot bar off the time axis, either into the toolbar's right group or above the axis with `bottom-[calc(axis+8px)]`. Add the candle-close countdown and a "UTC" label. | M: cleaner reading; nothing covers the dates | S–M | `AssetChartPanel.tsx:471-479,536-549,936`; [S] shots 1–2 |

**Also worth doing (not ranked):**
- `role="img"` and an `aria-label` summary on the chart containers (`AssetChartPanel.tsx:933`, `ReplayView.tsx:348`).
- Focus-visible rings in the header, side panel, card and replay.
- Replace `select-none` at the panel root (`AssetChartPanel.tsx:854`) with `select-none` on the toolbar only.
- Make `ReplayView` respond to theme changes (`ReplayView.tsx:66`).
- Don't capture Space when focus is on a button (`ReplayView.tsx:247`).
- Link trade IDs to Trades/forensics by passing `onOpenTradeForensics` from the modal (`AssetChartModal.tsx:49-58`).

---

## Appendix A: how the owner's complaints map to findings
- **"Indicators/Layers arrows don't drop down"**: §0 (overflow clipping). Ranks 2 and 12.
- **"You cannot click anything, everything is fixed"**:
  - history panning is dead (1.2)
  - the OHLC readout is unreachable (1.3)
  - overlay trades have no hover, and clicks select or deselect unpredictably (1.9)
  - signal dots are mute (1.10)
  - trade IDs aren't links and the forensics link never renders (1.6)
  - `select-none` blocks copying (1.14)
  - there are no tooltips, only `title` (1.15)

  Ranks 1, 5, 6, 14.
- **"I feel there's more there should be"**: §4.2 items 1–4, 6, 8 and 11 are the realistic additions.
- **"Not good design"**:
  - 6 type sizes against the app's own 11px contract (§3.1)
  - 9 tints of `bg-muted` and 6 border tints (§3.3)
  - four different snapshot controls (§4.1)
  - the card covering the trade (1.7)
  - controls on top of the axis (1.8)
  - colour meaning that contradicts itself (§2.7, §3.2)

## Appendix B: method
- Read every listed file in full, plus `index.css`, `tailwind.config.js`, `ui/button.tsx`, `ui/dialog.tsx`, `ui/dropdown-menu.tsx` and parts of `Performance.tsx`, `TopBar.tsx`, `StatusStrip.tsx`, `useCandles.ts` and `tradeModel.ts`.
- Counted class usage with `grep -o` over `src/components/assets/*.tsx`.
- Computed contrast with the WCAG 2.x relative-luminance formula, compositing alpha over the actual surface colour from `index.css`.
- No builds or app runs. Items marked [I] need confirming in the running app, especially 1.1 at 390px, 1.4 (Esc ordering), and the menu overflow at 390px.
