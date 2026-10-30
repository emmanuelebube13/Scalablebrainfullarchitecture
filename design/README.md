# ScalableBrain design governance

**What this is:** the single source of truth for how every ScalableBrain screen looks and
behaves — the telemetry dashboard, the control panel, this architecture site, and anything new.
**Who must follow it:** every agent and person who touches a screen. Each repo's agent
instructions (`CLAUDE.md`) point here.
**Owner:** the project owner approves visible changes; any agent may propose them.

## The documents

| File | Answers | Read when |
|---|---|---|
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | How a screen **looks**: the ten rules, fonts, colour tokens, spacing, layout, components, theme switching, writing | Always, first |
| [`INTERACTION-AND-HONESTY.md`](INTERACTION-AND-HONESTY.md) | How a screen **behaves** and what it may **claim**: rules H1–H7, I1–I7, L1–L4, each with the defect that motivated it | Before building anything interactive or anything that shows a number |
| [`DEFINITION-OF-DONE.md`](DEFINITION-OF-DONE.md) | What must be attached before a screen change counts as done; the lint and UI-check tools | Before calling anything finished |
| [`DECISIONS.md`](DECISIONS.md) | Why each contestable choice was made (DD-001…), and how to change one | When a rule seems wrong |
| [`BACKLOG.md`](BACKLOG.md) | Work the rules call for, ranked and scheduled | When planning |
| [`evidence/`](evidence/) | The original reports the rules were derived from, kept unedited | When you need the detail behind a rule |

## Order of precedence

1. Standing invariants (never place or modify an order; absent renders as absent) — never overridden.
2. `DECISIONS.md` — the latest entry on a topic wins.
3. `INTERACTION-AND-HONESTY.md`, `DESIGN-SYSTEM.md`.
4. Anything in a task brief. A brief may narrow the rules, never relax them.

## How governance changes

1. Write the proposal as a new `DECISIONS.md` entry (status "proposed"), with the evidence.
2. The owner approves anything visible; then update the rule file and mark the entry decided.
3. Never silently edit a rule. Never work around one in code "for now".

New evidence (an audit, a post-mortem, a defect the owner found) goes into `evidence/` as
`YYYY-MM-DD-<topic>.md`, unedited; the rules it produces are added to the rule files with a
reference back.

## Adoption status (2026-10-30)

| Surface | Status |
|---|---|
| Telemetry dashboard | Not yet compliant. Redesign under way (brief: `C:\SB\dev-umbrella\docs\design\REDESIGN-BRIEF-2026-10-30.md`). |
| Control panel | Not yet compliant. Scheduled W45. |
| This site | Not yet compliant (Space Grotesk, italic serif headings). Scheduled W45 (BACKLOG S4, G4). |
