# AuroTap: bounded disposable-data retention (2026-11-03)

## Purpose and scope
Stop unbounded database growth without affecting booking latency, customer data,
supplier orders, dispatch, audit evidence, pricing, payments, finance or notifications.

### Live audit baseline
- PostgreSQL total allocated size: 93 MB; public app tables: 55 MB.
- PIN import staging: 31 MB / 165,627 rows; active PIN table: 21 MB / 165,627 rows.
- Both tables cover all 19,586 distinct PINs, **but differ in schema and curated content**.
  Never automatically drop/truncate staging without an independently verified
  external backup, row-level mapping audit and restoration drill.
- cron.job_run_details: 12 MB / 7,469 runs, 5,453 older than 7 days, no failed runs
  at audit time. Historical records of failed runs must remain available.
- audit_logs: 2,727 rows; 2,699 historical no-supplier events for only 25 orders.
  Do not delete these; prevent repeated no-supplier event writes separately.
- notifications: 0 rows; push_tokens: 0 rows at audit time.

## What the daily job deletes
| Table | Qualifier | Cap per run | Why |
| --- | --- | --- | --- |
| cron.job_run_details | status=succeeded, completed > 7 days | 2,000 | successful *execution logs* only |
| public.otp_requests | expires_at > 2 days ago | 500 | expired one-time codes only |
| public.account_recovery_rate_limits | updated_at > 30 days ago | 500 | idle anti-abuse window counters |

This is a strict allowlist, not a generic old-data deletion rule.
Scheduled at 03:17 UTC daily (08:47 IST) through existing pg_cron.
Do not raise frequency for "instant" storage reduction: the whole point is
to keep maintenance off the critical user request path.

## What is explicitly not deleted
pincode_directory, pincode_directory_import_staging, orders,
order_dispatch, technician_job_dispatch, notifications, push_tokens,
profiles, addresses, settings, pricing_versions, wallets, payouts,
ledger, subscriptions, referral evidence, audit_logs, identity/session tables,
pending recovery cases, customer support submissions, admin approvals.
No VACUUM FULL, REINDEX, TRUNCATE or table drop is scheduled.

## Safe release and verification
1. Confirm CI and preview READY, then apply migration
   `20261103043000_bounded_disposable_retention.sql` once.
2. Verify job:
   `SELECT jobid,jobname,schedule,active FROM cron.job WHERE jobname='aurotap-bounded-disposable-retention';`
3. Check eligible rows before/after:
   `SELECT count(*) FROM cron.job_run_details WHERE status='succeeded' AND end_time < now()-interval '7 days';`
4. Inspect last run outcome in Supabase Cron History. **A successful pg_cron run
   is not proof that a technician dispatch HTTP endpoint succeeded**.
5. Monitor duration, checkout p95, pending orders and lock waits; if maintenance
   causes regression, unschedule only this new job. Keep the existing
   technician-dispatch-sweep unchanged.
6. PostgreSQL DELETE typically makes storage reusable; physical database size
   may not decrease immediately. Do not use lock-heavy VACUUM FULL on a live app.

## Rollback
`SELECT cron.unschedule('aurotap-bounded-disposable-retention');`
This disables new pruning immediately; the function can remain unused.
Deleted disposable records cannot be restored without a backup, hence
the narrow predicates and fixed batches.

## Future notification roadmap (not switched on by this release)
- Deliver background Web Push only after a user opt-in and valid device registration.
- Store critical retry events durably, not duplicate every order payload.
- Support per-user opt-out and channel preference while keeping the in-app order
  timeline authoritative.
- Apply retention only after notification delivery/receipt state is modeled.
- Keep application load safe: no faster polling or forced cache invalidation.
