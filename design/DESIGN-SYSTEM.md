# ScalableBrain Design System — the rule book

> **Status:** adopted 2026-10-30 (owner request). **Applies to:** the telemetry dashboard,
> the control panel, this architecture site, and anything new any agent builds with a screen.
> **Why it exists:** each surface was styled by a different agent. The result: three font
> families, two reds that both mean "bad", a sidebar that stays dark in light mode, a control
> panel that looks like another product, and italic serif headings on the reading site.
> One rule book, followed everywhere, fixes that for good.

If a rule here blocks something you need, do not work around it — propose a change to this
file. A rule changes for everyone or for no one. This file is one part of the design
governance in this folder: start at [`README.md`](README.md). Behaviour and honesty rules are
in [`INTERACTION-AND-HONESTY.md`](INTERACTION-AND-HONESTY.md); the checklist every change must
pass is [`DEFINITION-OF-DONE.md`](DEFINITION-OF-DONE.md); why each choice was made is in
[`DECISIONS.md`](DECISIONS.md).

---

## 1. The ten rules (read these if nothing else)

1. **Use tokens, never raw colours.** No hex values, no `rgb()`, no Tailwind hue classes
   (`text-emerald-400`, `bg-rose-500`, `bg-[#161B22]`) in components. Use the semantic tokens
   in §3 (`text-good`, `bg-surface`, `border-default` …). Raw colours are the reason light mode
   is broken.
2. **One font family:** IBM Plex Sans for all text, IBM Plex Mono for numbers, prices, ids,
   timestamps and code. Nothing else. No serif, no italics except a real quotation.
3. **A colour has one meaning.** Green = healthy / profit. Red = fault / loss. Amber = needs
   attention soon. Cyan (accent) = interactive / selected / informational. Grey = absent,
   unknown, closed. Never use a colour for decoration.
4. **Never colour alone.** Every status is icon + word + colour (`● OK`, `▲ WARN`, `✕ FAULT`).
5. **Absent renders as absent.** A missing number is "—" with the reason on hover/tap,
   never `0`, never a default. A confident wrong number is worse than a blank.
6. **Every red state says how to fix it.** A failing check shows (a) what is wrong in plain
   words, (b) the fix: a button that does it, or the exact step if no button can. Red with no
   way forward is not allowed. (Owner: "there should be a clear way of fixing it in the
   control panel, not asking someone else.")
7. **Both themes from the same tokens.** Light/dark is one attribute on `<html>`
   (`data-theme="light|dark"`). Every surface — sidebar, top bar, dialogs, charts, the
   control panel — must change with it. If a surface does not change, it is using raw colours.
8. **Mobile first: one column, no hunting.** At 360–430 px wide: the answer to "is it OK?"
   is visible without scrolling, the page never scrolls sideways, tap targets are ≥ 44 px,
   wide tables become stacked cards.
9. **Same building blocks everywhere.** Use the components in §6. Do not invent a new card,
   pill or table style for one screen.
10. **Sentence case, plain words.** "Risk gate paused", not "RISK GATE PAUSED" or
    "Risk Gate Paused". Short labels; the detail goes underneath.

---

## 2. Typography

| Role | Font | Size / line height | Weight | Notes |
|---|---|---|---|---|
| Page title | IBM Plex Sans | 24 / 32 px | 600 | One per page |
| Section title | IBM Plex Sans | 18 / 26 px | 600 | |
| Card title | IBM Plex Sans | 14 / 20 px | 600 | |
| Body / UI text | IBM Plex Sans | 14 / 20 px | 400 | Dashboard and panel default |
| Reading body | IBM Plex Sans | 16–17 / 1.6 | 400 | Architecture site; max width 72 characters |
| Small / meta | IBM Plex Sans | 12 / 16 px | 500 | Captions, timestamps labels |
| Micro label | IBM Plex Sans | 11 / 14 px | 500 | Badges, table headers, eyebrow labels. **11 px is the floor** (DD-005): 9 and 10 px are banned, as is any arbitrary `text-[Npx]` |
| Numbers, prices, ids, times | IBM Plex Mono | same as context | 400–500 | Always `font-variant-numeric: tabular-nums` |
| KPI value | IBM Plex Mono | 28 / 34 px | 500 | One per tile |

- **Self-hosted, not Google Fonts** (DD-012): the control panel must work with no internet, so
  both apps ship the font files. Each app has a byte-identical `src/styles/plex.css` (three
  `@font-face` rules) and `src/styles/fonts/` (Plex Sans variable 400–600 + Plex Mono 400 and
  500, Latin subset, about 75 KB in total). Import `plex.css`, never a Google Fonts URL. The
  reading site may keep the Google URL
  `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap`
  because it is only ever read online.
- Fallback stacks: `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif` and
  `"IBM Plex Mono", ui-monospace, "Cascadia Code", Consolas, monospace`.
- **Banned:** Inter, Space Grotesk, Instrument Serif, JetBrains Mono, any serif, `font-style: italic`
  for headings, ALL-CAPS headings (a 12 px uppercase eyebrow label with letter-spacing is the
  one exception).
- **Why Plex:** one family designed for technical interfaces, with a matching mono, clear
  digits (1/l/I and 0/O differ), tabular numbers, free, and readable for long notes as well
  as dense tables — so the dashboard and the reading site can share it.

---

## 3. Colour tokens

Define these as CSS custom properties on `:root` (dark is the default) and override them
under `:root[data-theme="light"]`. Tailwind projects map them in `tailwind.config.js`
(`colors: { good: 'rgb(var(--good) / <alpha-value>)', … }`) so `text-good/80` works.

### 3.1 Surfaces, text, lines

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0B0F14` | `#EEF1F5` | Page background |
| `--surface` | `#11161D` | `#FFFFFF` | Cards, sidebar, top bar, panels |
| `--surface-raised` | `#171D26` | `#F6F8FA` | Hover, nested rows, popovers |
| `--surface-sunken` | `#080B0F` | `#E3E7ED` | Inputs, code blocks, wells |
| `--border` | `#232B36` | `#D5DBE3` | Default 1 px lines |
| `--border-strong` | `#334050` | `#B8C1CD` | Focus-adjacent, dividers that matter |
| `--text` | `#E6EAF0` | `#101828` | Primary text |
| `--text-dim` | `#A7B0BE` | `#414B5A` | Secondary text |
| `--text-faint` | `#6B7686` | `#5D6B7E` | Meta, placeholders (never for numbers that matter) |

### 3.2 Meaning (one meaning each)

| Token | Dark | Light | Means | Never use for |
|---|---|---|---|---|
| `--good` | `#34D399` | `#047857` | Healthy, passing, profit, long-in-profit | Decoration, "buy" |
| `--bad` | `#F87171` | `#DC2626` | Fault, failing, loss, blocked | "sell", decoration |
| `--warn` | `#FBBF24` | `#B45309` | Needs attention soon, degraded, stale | Neutral info |
| `--accent` | `#22D3EE` | `#0E7490` | Interactive, selected, links, informational | Status |
| `--neutral` | `#94A3B8` | `#64748B` | Absent, unknown, market closed, disabled | Faults |

Tints are limited to two steps — 10 % (background) and 20 % (hover/selected) — for every
token, surfaces included (the chart had nine tints of `muted`, so no two panels matched).
Each has a tint for backgrounds: use the token at 10 % alpha (`bg-bad/10`), never a
second hue. **Rose, pink, emerald-300, orange, teal and red-500 variants are not separate
meanings** — they all collapse into the five above.

Direction (long/short, buy/sell) is **not** good/bad: show it as text (`LONG` / `SHORT`) with
an arrow (▲ / ▼) in `--text`; colour only the P&L.

### 3.3 Identity colours (labels only, always with the name)

| Token | Dark | Light | |
|---|---|---|---|
| `--s1` | `#818CF8` | `#4338CA` | System 1 — Brain |
| `--s2` | `#F472B6` | `#BE185D` | System 2 — Hand |
| `--s3` | `#C084FC` | `#7E22CE` | System 3 — Guardian |

Used only for a small dot or 2 px bar beside the system's name. Never as a status.

### 3.4 Charts

Up candle `--good`, down candle `--bad`, grid `--border` at 50 %, crosshair `--text-faint`.
Series colours in this order: `--accent`, `--s1`, `--warn`, `--s2`, `--s3`, `--neutral`.

Indicator lines get their own chart-scope tokens, which must **not** reuse a semantic hue
(DD-008: the chart used cyan for both EMA 20 and "selected", amber for both EMA 50 and
"warning", violet for four things): `--chart-ema-fast`, `--chart-ema-slow`, `--chart-band`,
`--chart-osc`. A line chart of price is drawn in `--text-dim`, never in `--good`/`--bad`
(a falling market drawn green is a lie). Charting code reads every colour from one theme
module and re-reads it when the theme changes.
Entry line `--text-dim` dashed, stop `--bad` dashed, target `--good` dashed.

---

## 4. Space, shape, elevation

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Nothing in between.
- Radius: one token `--radius: 10px` (0.625rem, the app's existing token — DD-006) for cards and
  dialogs, `calc(var(--radius) - 4px)` for inputs and buttons, 999 px pills. No raw `rounded`.
- Card: `--surface`, 1 px `--border`, radius 12, padding 16 (12 on mobile). No glow, no grain,
  no gradients. In light mode a single soft shadow `0 1px 3px rgba(16,24,40,.08)`.
- Density: table rows 36 px desktop, 44 px touch.
- Icons: one set (Lucide), stroke 1.75. Sizes by role: 12 px inline with small text, 14 px in
  toolbars, 16 px for standalone icon buttons (a close ✕ is 16 px everywhere).

---

## 5. Layout

### Desktop (≥ 1024 px)
Sidebar (240 px, collapsible to 64 px) · top bar (56 px) with the **system verdict pill**
(§6) always visible · content max width 1440 px, 24 px gutters.

### Tablet (640–1023 px)
Sidebar collapses to icons; content two columns at most.

### Phone (< 640 px)
- Bottom navigation with ≤ 5 items; the rest under "More".
- First screen of every view: the verdict pill + at most **4 KPI tiles** in a 2 × 2 grid.
  "Is everything OK, and what needs me?" must be answered without scrolling.
- One column. Sections collapse; the one with a problem opens itself.
- Tables → stacked cards showing the 3–4 fields that matter; "details" opens the rest.
- No horizontal page scroll. A chart may scroll inside its own box.
- Dialogs become bottom sheets.

---

## 6. Components (build once, use everywhere)

| Component | Rule |
|---|---|
| **Verdict pill** | Top bar, every view. Shows the one-line system state (`Trading`, `Paused — risk gate`, `Not trading — market closed`). Colour per §3.2; tap opens the chain (signals → risk → execution → market) with each link's reason **and its fix** (rule 6). |
| **Status pill** | icon + word + colour, 12 px, radius 999. Words: `OK`, `Warn`, `Fault`, `Off`, `Unknown`. |
| **KPI tile** | label (12 px, `--text-dim`), value (Plex Mono 28 px), one sub-line (delta or as-of). Absent value = "—". |
| **Card** | §4. Title row: title left, as-of time + actions right. |
| **Data table** | Mono numbers right-aligned, text left; sticky header; sortable headers show ▲▼; on phone becomes stacked cards. |
| **Empty / absent state** | Grey, says *why* it is empty ("No trades today", "System 3 not reporting since 10:04"). |
| **Stale marker** | Any panel whose data is older than its expected refresh shows `▲ Stale — 14 min old` in `--warn`. |
| **Fix action** | Next to any red/amber state: a button that performs the fix (with confirm for anything that changes trading), or the exact instruction. Buttons that change trading state follow the standing invariants (never open or enlarge a position). |
| **Confirm dialog** | States what will happen in one sentence, names the system it affects, requires typing `CONFIRM` for trading-state changes. |
| **Notification (bell)** | Severity per §3.2; title says what happened, body says what to do; action button jumps to the view that fixes it. |

---

## 7. Theme switching (how to not break it again)

- The toggle sets `document.documentElement.dataset.theme = 'light' | 'dark'` and stores it.
- Every colour in every component comes from §3 tokens, so nothing else changes.
- **Forbidden:** substring remaps like `:root.light [class*="text-emerald-4"] { … }` — they
  exist today only to paper over raw colours and must be deleted once the colours are tokens.
- Charts read tokens at render time and re-render on theme change.
- The control panel and the site use the **same** token file, so all three flip together.

---

## 8. Writing

- Status words are fixed: `OK`, `Warn`, `Fault`, `Off`, `Unknown`, `Stale`.
- Say what happened and what to do: "System 3 paused by operator at 22:07. Resume when ready →".
- Times (DD-004): every timestamp goes through **one shared parser** that treats a value with no
  zone as UTC (zone-less ledger times parsed as local put every trade 3 h off on the chart).
  Screens show UTC, labelled: `01:07 UTC`; the owner's local time is in the tooltip. Never call
  `new Date(string)` in a view.
- Money (DD-009): one shared formatter. Sign always written, true minus sign, before the
  number, currency code after: `−33.90 CAD`, `+124.33 CAD`. Never `$-33.90`. R-multiples `+0.84R`.
- No jargon a new reader would not know without a tooltip.

---

## 9. Enforcement

Every change to a screen must pass [`DEFINITION-OF-DONE.md`](DEFINITION-OF-DONE.md) — which
includes using the UI, not just building it — before it is called done.

## 10. Where things live

| Surface | Repo (edit here) | Token file |
|---|---|---|
| Telemetry dashboard | `C:\SB\dev-umbrella\telemetry-dashboard` (deploy to prod per its deploy guide) | `src/styles/tokens.css` |
| Control panel | `C:\SB\dev-umbrella\control-panel\web` | `src/styles/tokens.css` (copy of the same file) |
| Architecture site | `C:\SB\Scalablebrainfullarchitecture` | `assets/css/tokens.css` |

The three token files must be byte-identical; this document is the source of truth for them.
