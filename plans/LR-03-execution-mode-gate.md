# LR-03: Execution-mode config gate (shadow / practice / live)

**System:** S2 + ops · **Week:** W46 · **Depends on:** nothing · **Register:** DECEMBER-READINESS §2 "Config-Driven Execution Gate"

## Goal
Going live is one deliberate, verified configuration change, never a hand-edited
PowerShell line. S2 refuses to start if anything about the mode is inconsistent.

## Today
`C:\SB\prod\services\sb_service.ps1` pins the mode by hand:
- line 113: `$env:EXEC_SHADOW = 'false'`
- line 114: `$env:OANDA_ENV = 'practice'`, with another pin at line 175

The header says these are deliberate safety pins. Live credentials belong in
`C:\SB\secrets\oanda-live.env`, which is empty on purpose. The accounts switcher reads
live data GET-only.

## Steps
1. Create `systems/hand/config/execution_mode.json` holding:
   - `{"mode": "shadow"|"practice"|"live", "account_id_suffix": "…", "confirmed_by": "", "confirmed_at": ""}`
   - The account suffix is only the last 4 characters. Never put a full ID or key in git.
2. Add a preflight at the top of `systems/hand/src/system2/__main__.py`. It refuses to
   boot, with a clear log line and a red bell, when any of these hold:
   - the mode and `OANDA_ENV` disagree
   - the API host doesn't match the mode (`api-fxtrade` for live, `api-fxpractice` for
     practice)
   - the account ID suffix doesn't match
   - mode is live and `confirmed_by` or `confirmed_at` is empty, or older than 24h at
     first boot
3. Change `sb_service.ps1` to read the mode file instead of pinning. Keep the practice
   default: if the file is missing, practice + shadow.
4. Add a dashboard indicator (design system): the mode as a pill. Live gets the red frame
   from DECEMBER-READINESS §4.
5. Tests for every refusal case.
6. Write a runbook entry, "How to switch to live", in the site's `MASTER-RUNBOOK.md`.

## Acceptance
- DEV boots in shadow and in practice through the file.
- Every refusal case is tested.
- The runbook entry exists.
- **Switching to live is not part of this task.** That's the owner's call.

## Guardrails
Never write live credentials. Never set mode = live anywhere in this task.
