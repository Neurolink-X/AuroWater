# AuroTap — Durable Dispatch Queue Rollout

## Scope
PR #243 adds a PostgreSQL-backed work queue for pending supplier and specialist dispatch recovery. The existing order, stock, payment, ledger, and approval systems remain authoritative.

- OFF by default: dispatch_work_queue_enabled=false. Legacy retry continues unchanged.
- Atomic claims use SKIP LOCKED and a global database lease budget of 24.
- Up to 32 claims per worker in bounded 3-item microbatches, with three concurrent dispatch calls.
- Conditional Supabase Cron can invoke up to four workers every two minutes based on pending work.
- Completed or assigned orders leave the queue; unresolved internal errors remain for admin review.
- Admin operations: /admin/dispatch-queue, with explicit dead-letter requeue.
- A global checkout admission limiter is used only when queue mode is enabled, with 429 + Retry-After and a safe fail-closed 503. Same-UUID idempotent retries are checked first. Initial default is 48 new bookings/minute to leave headroom under the theoretical 64-claim/minute recovery ceiling; raise only after measured production-safe staging throughput supports it.
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
6. Activation atomically backfills up to 100 existing eligible PENDING orders before the queue turns ON. If more are missing, the activation transaction rolls back safely. For larger backlogs, call the service-role-only enqueue_existing_pending_dispatch(100) repeatedly on staging/rollout while the flag remains OFF, then retry activation. No incomplete handoff is allowed.
7. The low-cost per-minute reconciliation cron repairs orders committed during flag changes, without any HTTP call when the flag is OFF. Verify both its run history and the worker endpoint before activation.
8. Test real customer / supplier / technician workflow in a safe staging environment.
9. Monitor PENDING order age, oldest due work, dead letters, database CPU/locks, checkout 429 and API p95. Enable only a small monitored trial after acceptance.
10. Escalate worker frequency/concurrency only when real measurements justify it.

## Disposable queue throughput benchmark
Run only against a separate, disposable TEST/STAGING database, never production.
The test creates and drops ONLY its own dedicated aurotap_queue_bench schema.

- Set AUROTAP_TEST_DATABASE_URL to the isolated PostgreSQL test database URL.
- Set AUROTAP_ALLOW_QUEUE_BENCH to DISPOSABLE_DB_QUEUE_BENCHMARK_ONLY.
- Set AUROTAP_BENCH_ITEMS to 100, 1000, 10000 or 100000.
- Execute npm run test:dispatch:queue-bench.
- Record queue inserts/sec, claim p50/p95/p99, max simultaneous leases and DB CPU.
- Separately run existing test:dispatch:db with disposable supplier/technician fixtures.
- Benchmark results describe SQL queue mechanics only, NOT full AuroTap bookings.
- Do not enable new billable infrastructure or run production load traffic.

## Admin-controlled ON/OFF (PR #246)

The queue **never switches ON automatically when load increases**. An authorized admin may view queue status and request a manual ON/OFF change at **/admin/dispatch-queue**. This is not worker autoscaling.

- **OFF:** returns to the existing legacy scheduled retry mechanism. Existing queued work and real customer records are preserved.
- **ON:** requires explicit admin confirmation, server-only environment variable **AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED=true** and the database activation trigger's atomic pending-order backfill safety check. This flag is an operator approval after reviewing all release gates above, not something to enable simply to test the UI.
- A missing database migration/configuration, failed backfill or absent server approval blocks activation. Error messages must be shown to the admin.
- Set the server approval variable only in the approved environment after isolated DB concurrency, browser E2E, migration/cron validation and preview health checks pass. Remove approval after rollout if operators should no longer be able to re-enable without a new change review.
- Queue ON/OFF controls do not scale Supabase, Vercel, database connections or worker concurrency dynamically. No production load-based auto-activation is implemented.

## Rollback
Set dispatch_work_queue_enabled=false using approved admin configuration. Legacy dispatch retries continue. Do not drop the table or destroy queued/customer records; collect diagnostics and inspect /admin/order-health.

## Security and privacy
Queue stores order IDs plus transport status, not customer phone, address, GPS or payment details. Only service_role may read/write queue rows or invoke claim and finish RPCs. The admin UI requires admin authentication. Expired terminal transport data may be pruned without deleting business history.

The 100k-item unit simulation checks code invariants only; it is NOT a database throughput certification, real-device benchmark, or production load test.
