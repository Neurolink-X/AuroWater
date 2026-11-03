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

## PR #247: production readiness and stale-order quarantine

The initial queue schema is installed on the production Supabase project **with its flag OFF**. The hardening migration `20261103111000_dispatch_queue_activation_readiness_and_stale_review.sql` must be applied after review to add:

- Readiness RPC (`dispatch_queue_release_readiness`) usable only by the service-role server and verified admin API. It reports only booleans/counts: queue/reconcile cron active, Vault token present, auto-assign setting and number of eligible pending orders not yet handed off.
- Admin Queue page activation checklist; **ON button disabled** without server operator approval and the required database prerequisites.
- Explicit generic Admin Settings rejection of `dispatch_work_queue_enabled` and the queue admission limit; these must not bypass the controlled rollout.
- Queue backlog reconciliation and **manual review for missed appointments older than 24 hours**, preserving the original order. Old slots must be reconfirmed and rescheduled using the legitimate order-management flow before an admin requeues.
- Claim/auto-retry must exclude stale slots, even if the maintenance scheduler has not quarantined them yet.
- Secure failure on missing cron, Vault secret or disabled assignment, including direct SQL setting activation.
- Additional migration `20261103113000_dispatch_queue_service_role_atomic_audit.sql` denies browser-authenticated direct SQL queue activation; only a trusted service-role server request is accepted. The dedicated `set_dispatch_queue_enabled` RPC writes the queue flag and an `audit_logs` entry in **one transaction**. A failed audit rolls back activation. This keeps generic Admin Settings and direct RLS-authorized edits from bypassing release gates.


### Last observed backlog (source check, 3 Nov 2026)
The production database had 12 unassigned eligible PENDING orders, of which 11 had appointments more than 24 hours overdue. They must not be silently offered again when the queue turns ON. This is a historical snapshot, not a live counter. The readiness RPC shows current counts without returning customer information.

### Staged enable procedure (no automatic activation)

1. Deploy PR #247 with green CI, CodeQL and Vercel production READY; apply both reviewed SQL hardening migrations separately, still OFF. Both SQL migrations were already installed on the production Supabase project during development with the flag confirmed OFF; reconcile the recorded migration history before a fresh environment deployment.
2. Query the new readiness RPC, verify row permissions and existing cron jobs, check the Admin page.
3. Verify `vault.aurotap_cron_secret` matches the Vercel internal worker secret with a safe authenticated no-work probe while queue OFF; cron-job scheduling success alone does **not** prove the HTTP request returned 200. **Observed:** a single authenticated OFF-queue probe returned HTTP 200 with zero claims and zero worker errors on 3 Nov 2026. This does not prove a real supplier assignment.
4. Validate test supplier/specialist assignments and duplicate race/stock, pending-order age, failed token and dead-letter recovery in an isolated database, including a correct fresh appointment.
   If more than 100 pending orders need backfill, an authorized Admin can click **Prepare next 100 pending orders (no dispatch)** repeatedly while the flag remains OFF. The action adds only queue metadata, quarantines overdue work, and is never a manual order-creation or provider-assignment endpoint.
5. Only then set server-only Vercel production env `AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED=true`; it requires a deployment to become effective.
6. Use Admin → Dispatch Queue to explicitly enable; activation backfills existing pending work (up to 100 in the same transaction), quarantine old overdue slots, and switches the legacy retry off.
7. Monitor actual HTTP worker responses and claim/assignment count, 429, oldest PENDING age and successful booking on real devices. Roll back by Admin Queue OFF if anomalies occur.

**Do not confuse** schema installed, GitHub green, Vercel READY and verified end-to-end activation. Do not change payment/ledger/orders to force traffic or run a production 100k load test.

## Rollback
Set dispatch_work_queue_enabled=false using approved admin configuration. Legacy dispatch retries continue. Do not drop the table or destroy queued/customer records; collect diagnostics and inspect /admin/order-health.

## Security and privacy
Queue stores order IDs plus transport status, not customer phone, address, GPS or payment details. Only service_role may read/write queue rows or invoke claim and finish RPCs. The admin UI requires admin authentication. Expired terminal transport data may be pruned without deleting business history.

The 100k-item unit simulation checks code invariants only; it is NOT a database throughput certification, real-device benchmark, or production load test.
