# AuroTap production security checkpoint — 2026-10-31

Scope: Supabase project `mwfcwhxdlnqldciigicl`. Checks here do not expose customer/order information.

## Applied migration history (verified by Supabase)

- `20261031020324_security_rpc_permissions_rls_initplan_20261031`: RPC grants, customer stats invoker rights, four role-aware RLS policy optimizations.
- `20261031020405_secure_masked_order_views_20261031`: RLS-invoker views plus assignment-gated contact projection.
- `pin_trusted_function_search_paths_20261031`: 11 trusted search paths (verify actual version using `list_migrations`).

**Do not replay** SQL files blindly against production. The older SQL bundle and timestamped migration directory were not fully reconciled before this change. PostgreSQL schema is now the live authority for verification; new environments need a fresh, reviewed migration baseline.

## Verified behaviors

- Anonymous role cannot EXECUTE protected supplier and technician stock/acceptance RPCs.
- Only service_role can EXECUTE atomic supplier/technician assignment.
- `get_customer_stats` is SECURITY INVOKER.
- Supplier/technician order views have both `security_invoker=true` and `security_barrier=true`.
- Impersonated assigned supplier (read-only transaction) saw 6 own orders, 1 eligible accepted contact; no premature contacts.
- Impersonated outsider saw zero supplier or technician orders and zero contact rows.
- Representative supplier view query returned 26 rows in about 5.8ms execution time. This is an individual DB query, **not** end-to-end app latency.
- Supabase function_search_path_mutable linter went from 11 to 0 after migration.

## What this does NOT prove

- Live full customer booking/payment/refund flow, technician completion, load under concurrency.
- Continuous mobile scroll smoothness and production Web Vitals; browser field data is needed.
- Database migration replay on a fresh project; older migration history still needs reconciliation.
- Remaining performance warnings (duplicate policies/index review) and auth password-leak protection dashboard setting.

## Recheck (read-only)

Run `npm run db:inspect-live` with `SUPABASE_DB_URL` configured privately. It reports metadata-only `hardened_security` findings; a PASS is *not* a substitute for real role-level smoke tests.

Do not place database credentials in source code or GitHub comments.
