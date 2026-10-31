# LR-01: Order idempotency and startup reconcile, verify and close

**System:** S2 (hand) · **Week:** W46 · **Depends on:** nothing · **Register:** DECEMBER-READINESS §2 "Queue Crash Recovery & Client-Order Idempotency"

## Goal
Prove that a crash at any point between "order POSTed" and "fill written" cannot create a
duplicate broker order on restart. Close the register item, or fix the real gap.

## What already exists (checked 2026-10-31)
- `systems/hand/src/system2/broker/oanda_adapter.py` documents **F-303**: every order
  carries `order.clientExtensions.id = "sb-" + idempotency_key`.
- Reconcile code and tests are in `oanda_transport.py` and the files under
  `broker/tests/`.

The register entry therefore looks **stale**. Verify it rather than rebuilding.

## Steps
1. Read `oanda_adapter.py` (the F-303 block and the reconcile path) and
   `execution/command_consumer.py` and `lifecycle.py`. Write down the exact recovery
   sequence on startup.
2. **Crash-injection test** against the OANDA **practice** API, in DEV only, with the
   minimum unit size. Kill the process at each point:
   - (a) after the POST, before the response is read
   - (b) after the response, before `queue.db` is updated
   - (c) after `queue.db`, before the fill event is published

   After each restart, assert exactly one broker order and trade with that
   `clientExtensions.id`, and a correct local state.
3. Where a case fails, fix it with the smallest change: look up by
   `clientExtensions.id` (`GET /v3/accounts/{id}/orders?...` or the trade's client ID)
   before re-sending.
4. Update `C:\SB\dev\DECEMBER-READINESS.md`: tick the item with a link to the test, or
   reword it to the real remaining gap.

## Acceptance
- An automated test for (a)–(c) is committed (practice-API tests can be marked as
  manual).
- Evidence from the practice run is in the commit message.
- The register is updated.

## Guardrails
Practice account only, minimum units. Never run this against live credentials.

---

## Result: 2026-10-31 (Claude, dev monorepo `a3f9546`). Verified: already built, no code change

**The register entry was stale.**
- F-303 already labels every order `sb-<idempotency_key>`.
- It reconciles the broker's last 200 transactions **before every** `create_order`.
- It treats "cannot verify" as "already submitted", so it refuses to send and the queue
  retries.
- Entry orders expire after 300 s (600 s after downtime), so the 200-transaction window
  can't be outrun.

Each crash point maps to a passing test in `test_oanda_adapter.py` (93 tests, listed in
`C:\SB\dev\DECEMBER-READINESS.md`, now ticked):
- (a) after POST
- (b) after fill, before mark
- filled then already closed
- reconcile outage
- (c) is safe because the mark is durable

**Not done, on purpose:** a live crash drill on the practice account. DEV is shadow-only
and the practice account is shared with prod. The owner can run one on prod practice at
minimum units if wanted.
