# Database integrity/security follow-up — 2026-11-02

## Verified read-only findings
- Public tables without RLS: **0**; invalid indexes: **0**.
- Three existing NOT VALID constraints: supplier foreign key on order_dispatch, payment collector allowed values, nonnegative collected amount.
- Live checks found **0** orphan supplier references, **0** invalid payment collector values, **0** negative collected amounts.
- Security advisor flags **2 anonymous-executable SECURITY DEFINER role helpers** and **19 authenticated-executable privileged functions**. These require per-function authorization checks; don't blindly revoke access used by legitimate app features.
- 16 tables have RLS but no policy; some may intentionally be server-only.
- Performance advisor reports **35 unindexed foreign keys**; index selection needs query plans and write-cost assessment.
- Migration history still needs reconciliation; registry is not proof of a clean rebuild.

## Changes in this PR
- SQL for validating the three constraints with bounded lock/statement timeouts.
- Remove anonymous execution of role helpers; preserve authenticated access.
- **No production SQL executed by this PR.** Deploy only after code caller audit and migration review.

## Post-deploy checks
1. Confirm `pg_constraint.convalidated=true` for the three constraints.
2. Confirm `has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')=false` and likewise for `current_profile_role()`.
3. Test anonymous homepage, authenticated booking, supplier accept, admin dashboard, payouts and recovery.
4. Re-run Supabase security/performance advisors.
5. Inspect order/dispatch error rates; rollback function grants if verified legitimate callers break.

## Still open
Queue durability, high-scale backpressure, stale pricing, realtime delivery, full migration rebuild, serviceability consistency, and isolated load testing are **not fixed by this PR**.
