# AuroTap — Durable Dispatch Queue Rollout

## Scope
PR #243 adds a PostgreSQL-backed work queue for pending supplier and specialist dispatch recovery. The existing order, stock, payment, ledger, and approval systems remain authoritative.

- OFF by default: dispatch_work_queue_enabled=false. Legacy retry continues unchanged.
- Atomic claims use SKIP LOCKED and a global database lease budget of 24.
- Up to 32 claims per worker in bounded 3-item microbatches, with three concurrent dispatch calls.
- Conditional Supabase Cron can invoke up to four workers every two minutes based on pending work.
- Completed or assigned orders leave the queue; unresolved internal errors remain for admin review.
- Admin operations: /admin/dispatch-queue, with explicit dead-letter requeue.
- A global checkout admission limiter is used only when queue mode is enabled, with 429 + Retry-After and a safe fail-closed 503. Same-UUID idempotent retries are checked first.
- No paid queue vendor or new persistent full-order payload copies.

## Critical capacity limitation
The initial scheduler handles at most 128 queue claims every two minutes in theory, or 64 claims/minute and 3,840 claims/hour. Actual successful assignments are fewer and MUST be measured.

A hypothetical 100,000-item backlog would take more than 26 hours even at that ideal claim rate to be touched once. This release does NOT certify 100,000 simultaneous bookings or guarantee real-time dispatch at that scale. Additional capacity, worker autoscaling, throughput testing and infrastructure may be needed.

## Release gates
1. Green lint, unit, regression, CodeQL and production build; no bypassing failed gates.
2. Use isolated disposable PostgreSQL test fixtures to validate 100, 1,000, 10,000 and 100,000 distinct queue items. Never attack production or use real customer data.
3. Stress duplicate enqueue, same-order race, max 24 leases, lease expiry, stale-token ack, crash recovery, no-provider backoff, dead-letter requeue and stock reservation races.
4. Check authenticated API, service-only database privileges, rollback flag, and lack of PII in queue rows.
5. Deploy schema with the flag still OFF; confirm no order behavior change and no unexpected compute billing.
6. Test real customer / supplier / technician workflow in a safe staging environment.
7. Monitor PENDING order age, oldest due work, dead letters, database CPU/locks, checkout 429 and API p95. Enable only a small monitored trial after acceptance.
8. Escalate worker frequency/concurrency only when real measurements justify it.

## Rollback
Set dispatch_work_queue_enabled=false using approved admin configuration. Legacy dispatch retries continue. Do not drop the table or destroy queued/customer records; collect diagnostics and inspect /admin/order-health.

## Security and privacy
Queue stores order IDs plus transport status, not customer phone, address, GPS or payment details. Only service_role may read/write queue rows or invoke claim and finish RPCs. The admin UI requires admin authentication. Expired terminal transport data may be pruned without deleting business history.

The 100k-item unit simulation checks code invariants only; it is NOT a database throughput certification, real-device benchmark, or production load test.
