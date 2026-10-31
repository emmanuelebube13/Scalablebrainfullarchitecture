# LR-05: Circuit-breaker latch and owner reset

**System:** S3 · **Week:** W47 · **Depends on:** LR-04 (thresholds) · **Register:** DECEMBER-READINESS §3

## Goal
When a drawdown or anomaly limit trips, trading halts, **stays halted across restarts**,
and resumes only when the owner explicitly acknowledges it.

## Steps
1. Find the current drawdown and breaker code. Start with `grep -rn "drawdown\|circuit"`
   over `systems/guardian/src/ams`, then look at `ams/config.py`, `ams/ctl.py` and
   `gate/layers.py`. Write down what exists and what is in-memory only.
2. Create two `ams.db` tables:
   - `ams_circuit_breaker_log`: append-only, holding `tripped_at`, `rule`, `value`,
     `threshold`, `reset_at`, `reset_by`
   - `ams_runtime_flags`: holds `halted` (bool) and `reason`
3. On a trip:
   - Set the flag.
   - Write the STOP sentinel `C:\SB\prod\state\control\STOP`, using the same mechanism as
     the emergency STOP, which stays absolute (W45-D3).
   - Post a red bell notice.
   - The S3 admission pipeline rejects everything while the flag is set.
4. On startup, read the flag before admitting anything.
5. Reset: `sb_control.ps1 -ResetCircuitBreaker` plus a dashboard button with a two-step
   confirm. Both write the reset row with who and when. Neither lifts the emergency STOP
   unless the owner chooses both.
6. Tests:
   - A trip persists through a restart.
   - A reset clears it.
   - Admission is refused while halted.
   - Open trades are **not** closed by the breaker. It blocks new risk only, unless the
     owner decides otherwise.

## Acceptance
- Tests pass.
- A DEV drill (force a trip, restart, reset) is recorded in the commit.
