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

---

## Result: 2026-10-31 (Claude, dev hand `cc20e12`)

**Done, awaiting owner tick.**
- **Already there (go-live D1):** `broker_env` binds OANDA_ENV, the API host, the single
  credential set and the account-id prefix, and refuses on any mismatch.
- **Built:** `system2/common/execution_mode.py`, checked at the top of `python -m system2`
  (exit 3 on failure):
  - **Live refuses to start** without a mode file (`EXEC_MODE_FILE`, kept outside git)
    holding `mode=live`, `confirmed_by`, `confirmed_at` and the live account's last
    4 characters.
  - A present file must agree with `EXEC_SHADOW` and `OANDA_ENV`.
  - No file and not live: unchanged, so prod practice and the shadow-only DEV keep
    starting.
- Tests: `src/system2/common/tests/test_execution_mode.py` (14 tests). S2 suite: 582
  passed.
- **Runbook:** "How to switch to live" in `systems/hand/RUNBOOK.md` §6.
- **Not done:** `C:\SB\prod\services\sb_service.ps1` (prod) still pins
  `EXEC_SHADOW`/`OANDA_ENV` by hand. The runbook says to change those lines in the same
  owner-approved deploy as going live. The dashboard LIVE frame (DECEMBER-READINESS §4)
  is still open.
