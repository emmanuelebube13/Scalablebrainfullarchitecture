# LR-02: Slippage bound and post-fill geometry check

**System:** S2 · **Week:** W46 · **Depends on:** nothing · **Register:** DECEMBER-READINESS §2 "Broker-Side Slippage Bounds & Geometry Sanity"

## Goal
No live trade can end up with an inverted risk/reward, i.e. a fill beyond its own stop or
target.

## What already exists (checked 2026-10-31)
- `broker/execution_limits.py` defines `MAX_SLIPPAGE_PIPS_MAJOR = 2.0` and
  `MAX_SLIPPAGE_PIPS_CROSS = 3.0`.
- `oanda_adapter.py` sends `priceBound` on market orders and has a spread guard
  ("Go-live B1/B3").

The first half of the register item is **done**. The open part is the **post-fill
geometry check**.

## Steps
1. Confirm `priceBound` covers every market order path, including research-book orders
   (ADR-003) and timed-exit closes (closes should *not* be bounded; check that they
   aren't). Also confirm the index, bond and commodity CFDs get a sensible bound: pips
   don't mean the same thing for JP225 (see the S1 DQ index-spread fix).
2. Add a post-fill check in `execution/lifecycle.py`. For a long, a fill price ≥ TP or
   ≤ SL is broken geometry (mirrored for shorts), as is a planned R:R that becomes < 0.3
   after the fill. In that case:
   - Close the trade at market immediately, using the lifecycle's own close command.
   - Post a red bell notice naming the order.
   - Journal the trade with `exit_reason = 'broken_geometry'`.
3. Unit tests for the long and short cases and a normal fill. Replay order 2879, the
   22.4-pip slip, as a fixture.
4. Update the register.

## Acceptance
- Tests pass.
- The CFD bound sanity is noted.
- The register is updated.

## Guardrails
The close uses the existing close path. No new order types.
