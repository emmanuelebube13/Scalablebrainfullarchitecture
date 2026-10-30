# Definition of done for any UI change

> Part of the [design governance](README.md). A screen change is **not done** until every item
> below is attached to it (PR description, task note, or the agent's report). "It builds",
> "tests pass" and "it looks right in a screenshot" are not done — the 2026-10-30 chart passed
> all three and could not be clicked.

## The checklist

1. **Real-data screenshots** of the changed view, with its primary content populated from the
   real API (an empty state is not a pass — H4):
   - 1440 × 900 dark, 1440 × 900 light
   - 390 × 844 (phone) dark, and light
   Every surface changes with the theme, sidebar included (DESIGN-SYSTEM rule 7). On the phone
   the verdict and KPIs are visible without scrolling and nothing scrolls sideways (rule 8).
2. **Interaction run** with the headless UI check (below): every new or changed control is
   clicked and its visible effect asserted (I3); every popover asserted fully on screen
   (`document.elementFromPoint` lands inside it — I1); zero console errors.
3. **Keyboard pass:** every control reachable by Tab, operable with Enter/Space/arrows, closed by
   Esc in the right layer (I4, I5).
4. **Honesty pass:** the diff has no `?? <number>`, `|| 0` or hard-coded percentages in display
   code; every number shows its source, scope and `n` (H1–H3). With the data source stopped,
   the view says why and shows no zeros.
5. **Token pass:** design-lint clean for the touched files — no hex colours, no Tailwind hue
   classes, no arbitrary `text-[Npx]`, no font other than IBM Plex, no italic headings, no raw
   `rounded` (DESIGN-SYSTEM §2–4).
6. **Contrast:** text ≥ 4.5 : 1 (≥ 3 : 1 for ≥ 24 px, or ≥ 18.66 px bold) against the **actual**
   background token it sits on, in both themes. Targets ≥ 24 × 24 px (44 px on touch).
7. **Fix-it pass:** every red/amber state the change can show offers its fix (I7).
8. **Report honestly:** list every view touched, anything not finished and why, and any rule
   you had to break — with the proposed change to the rule.

## Tools

| Tool | Where | Status |
|---|---|---|
| **design-lint** — fails on the token-pass patterns above, plus `absolute top-full` and hand-written outside-click handlers in feature code (I1) | `tools/design-lint` in each repo (dashboard, control panel, site) | To build — W45 |
| **UI check** — drives headless Chrome over CDP with Node 24's built-in `WebSocket`, no extra dependencies; one script per view: click every control, assert effect, assert popovers on screen, collect console errors, take the four screenshots | `telemetry-dashboard/scripts/ui-check/` (promote the 2026-10-30 chart-session driver) | To build — W45 |

Until the tools exist, do items 2 and 5 by hand and say so in the report.
