# Design backlog

> Part of the [design governance](README.md). Work that the rules call for, ranked. Each item
> becomes a task on the [week plan](../week.html) when it is scheduled; mark it here with the
> task id.

## Governance tooling

| # | Item | Scheduled |
|---|---|---|
| G1 | `tools/design-lint` in the dashboard, control panel and site repos (DEFINITION-OF-DONE tools) | W45-WED |
| G2 | Promote the CDP headless UI-check driver to `telemetry-dashboard/scripts/ui-check/`, one script per view | W45-WED |
| G3 | Shared `tokens.css`, byte-identical in all three repos; Tailwind maps semantic names | W45-WED |
| G4 | `design.html` on this site: renders the rules with live swatches, type scale and component examples | W45-THU |
| G5 | Shared formatters: money (DD-009), time (DD-004), percent/R | W45-WED |

## Surfaces to bring under the rules

| # | Surface | Scheduled |
|---|---|---|
| S1 | Dashboard shell: sidebar (hard-coded `#0D1117`), top bar, mobile nav, dialogs, bell | W45-WED |
| S2 | Market Assets, Risk Gate, System Settings | W45-THU |
| S3 | Control panel: same tokens and shell, light mode | W45-THU |
| S4 | Architecture site: Plex, no italic serif, shared tokens | W45-THU |
| S5 | Asset chart: the top 15 fixes in `evidence/2026-10-30-chart-design-audit.md` §5 (`ui/` primitives, type floor, token colours, one toggle/popover/toast) | W46 |
| S6 | Every remaining view to zero lint findings; delete the light-mode substring remaps | W46 |

## Chart features (owner: "there should be more"; all read-only)

Ranked by value to a single operator going live in December (from the chart insights §4):

1. Strategy rows as filters (highlight trades, filter the closed list).
2. Hover any past entry marker for a mini card.
3. Measure tool (pips, %, bars, R).
4. Session shading (Tokyo, London, New York).
5. Regime as a background band along the time axis.
6. Replay of an open trade from entry to now.
7. Compare-to-plan on closed trades (planned R:R vs achieved, MFE/MAE).
8. Local-only alert lines (no orders — ask the owner first).
9. Economic calendar markers — only from a free source.
10. Light-theme verification of the chart.
