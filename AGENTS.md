
# AuroTap — Supabase PostgreSQL Engineering Rules

## Mission
Maintain a secure, scalable, reliable, and fast database
for AuroTap's customer, supplier, technician, plumber,
and admin workflows.

Follow the installed supabase-postgres-best-practices skill
whenever available.

## 1. Mandatory Database Rules
- Never modify production data without explicit approval.
- Never drop tables, columns, policies, or indexes blindly.
- Never expose service-role or secret keys to clients.
- Enable appropriate RLS on exposed tables.
- Enforce role and ownership checks on sensitive operations.
- Never trust client-supplied prices, roles, or order totals.
- Validate inputs on the server.
- Use transactions for related financial operations.
- Use parameterized SQL.
- Preserve backwards compatibility during deployments.

## 2. Performance Optimization
- Investigate slow queries with EXPLAIN ANALYZE
  in a safe environment.
- Detect N+1 queries and excessive database requests.
- Prefer selecting required columns over SELECT *.
- Add indexes only when query patterns justify them.
- Review unused and duplicate indexes before removal.
- Paginate large datasets.
- Avoid unnecessary polling and repeated writes.
- Use connection pooling appropriately.
- Monitor connection limits and lock contention.
- Optimize queries without sacrificing correctness.

## 3. Orders and Dispatch
- Prevent duplicate order creation.
- Use idempotency keys for booking and retry workflows.
- Ensure supplier assignment is atomic.
- Prevent concurrent stock over-allocation.
- Enforce supplier eligibility, coverage, and capacity.
- Keep dispatch attempts and retries bounded.
- Prevent multiple workers from claiming the same job.
- Keep order status transitions consistent.
- Never assign an unavailable or unauthorized supplier.

## 4. Financial Safety
- Treat financial ledger entries as append-only.
- Prevent duplicate earnings and payouts.
- Enforce unique transaction references where appropriate.
- Never trust frontend-calculated payout amounts.
- Reconcile order payments, collections, and settlements.
- Use transactions for financial state changes.
- Maintain audit trails.
- Never silently change historical financial records.

## 5. Security and Authorization
- Apply least-privilege access.
- Verify ownership on customer resources.
- Restrict supplier access to authorized jobs.
- Restrict technician access to authorized assignments.
- Protect admin-only operations server-side.
- Never use user-editable metadata for authorization.
- Review SECURITY DEFINER functions carefully.
- Prefer SECURITY INVOKER where appropriate.
- Use explicit search_path for privileged functions.
- Protect uploaded identity documents and KYC files.
- Never place sensitive documents in public buckets.

## 6. Reliability and Scale
Design for:
- 100 users
- 10,000 users
- 100,000 users
- 1,000,000 users

Use workload measurements rather than assuming
a system is scalable.

Prioritize:
- Efficient queries
- Bounded concurrency
- Idempotent operations
- Queue-based background processing
- Safe retry mechanisms
- Backpressure
- Connection management
- Monitoring and alerting
- Recovery from transient failures

Do not claim million-user readiness without load tests.

## 7. Migration Safety
Before applying schema changes:
1. Inspect the existing schema.
2. Review migration history.
3. Check for conflicting migrations.
4. Create a versioned migration.
5. Test on a development or staging database.
6. Validate RLS and access permissions.
7. Verify rollback or forward-recovery procedures.
8. Check application compatibility.
9. Run automated tests.
10. Require approval before production deployment.

Never rewrite migrations that have already been applied.

## 8. AuroTap Critical Workflows
Protect these flows with integration tests:

- Customer booking and payment
- Supplier onboarding and admin approval
- KYC document verification
- Technician and plumber onboarding
- Supplier dispatch and stock reservation
- Subscription generation, pause, and resume
- Wallet and payout reconciliation
- Refunds and cancellations
- Admin account recovery
- Order notifications
- Role-based data access

## 9. Monitoring and Self-Recovery
- Record structured errors without leaking sensitive data.
- Monitor slow queries and connection saturation.
- Detect failed dispatch and stuck orders.
- Retry transient errors with bounded exponential backoff.
- Use dead-letter handling for exhausted retries.
- Detect financial reconciliation mismatches.
- Alert administrators on critical failures.
- Do not automatically retry unsafe financial operations
  without idempotency protection.
- Never automatically change database schema to fix errors.

## 10. Required Verification
For every database change:
- Run SQL/schema validation.
- Run relevant integration tests.
- Check access permissions and RLS.
- Validate concurrent operations.
- Check performance impact.
- Verify migration compatibility.
- Review Supabase security and performance advisors.
- Report remaining risks.

## 11. Engineering Output
Whenever modifying database logic, report:

1. Problem identified
2. Root cause
3. Files changed
4. SQL or migration changes
5. Security impact
6. Performance impact
7. Tests executed and their actual results
8. Remaining blockers

Never claim tests passed without executing them.

## Final Rule
Correctness and security come before optimization.

No destructive changes.
No fake performance claims.
No unverified production deployments.
No silent financial inconsistencies.
