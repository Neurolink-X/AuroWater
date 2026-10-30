# Database, dispatch and performance verification

This document separates source-level checks from checks that require a disposable or live Supabase project.

## 1. Live Supabase database inspection (read-only)

The repository includes `npm run db:inspect-live`. It runs a PostgreSQL read-only transaction and reports:

- RLS enabled/forced state for the core dispatch and waitlist tables.
- Actual columns and nullability.
- Policies and indexes.
- Candidate migration-tracking tables (without assuming a `supabase_migrations` schema).
- Execute privileges for the supplier/technician atomic dispatch RPCs.

Run it from a trusted workstation with a read-only database role:

```bash
SUPABASE_DB_URL='postgresql://READ_ONLY_USER:...@HOST:PORT/postgres?sslmode=require' npm run db:inspect-live
```

Do not put database credentials in source control, CI logs, screenshots or ChatGPT messages. Do not use a service-role connection for routine inspection if a read-only role is available.

The script does not run migrations, alter schema, or read customer/order rows.

### Migration reconciliation rule

The legacy `sql/` bundle and timestamped `supabase/migrations/` directory are separate migration streams. The four legacy files currently not in the explicit bundle are:

- `006_supplier_payout_lifecycle.sql`
- `030_supplier_profile_change_requests.sql`
- `031_supplier_profile_address_fields.sql`
- `032_orders_cancel_reason_compat.sql`

They share numeric prefixes with different files already in the bundle. Do not append them based on filename order. Review their dependencies and compare each expected object with the live catalog first.

The waitlist migration `202610300004_city_waitlist_contact_and_ncr.sql` is already included in the manual bundle. The live database check previously supplied confirms its expected `area`, `pincode`, nullable `phone`, and three lookup indexes exist. That is schema evidence, not proof of the migration's recorded execution history.

If the project has no application migration ledger, establish the authoritative deployment history from the team's migration workflow / Supabase CLI linked-project history and deployment records before claiming reproducible fresh-environment parity. Do not create a fake ledger after the fact.

## 2. Database-backed dispatch concurrency tests

The opt-in runner is `npm run test:dispatch:db`. It invokes the real Postgres RPCs concurrently and checks:

1. Two suppliers racing for one water order: exactly one assignment wins.
2. Two water orders racing for one supplier's limited stock pool: exactly one stock reservation wins.
3. Two technicians racing for one technician-service order: exactly one assignment wins.

It intentionally mutates fixture orders and is therefore restricted to a disposable database. It refuses to run unless the database name contains `test`, `staging` or `branch`, the explicit safety flag is set, and every order number begins `TEST-DISPATCH-`.

Required environment:

```bash
AUROWATER_ALLOW_DISPATCH_TESTS=1
AUROWATER_TEST_DATABASE_URL='postgresql://...'
AUROWATER_DISPATCH_TEST_FIXTURES='{"supplierRaceOrderId":"...","supplierIds":["...","..."],"stockRaceOrderIds":["...","..."],"stockRaceSupplierId":"...","technicianRaceOrderId":"...","technicianIds":["...","..."]}'
npm run test:dispatch:db
```

Provision the fixture profiles, stock rows and unassigned pending orders in a disposable Supabase branch/local project first. Each order must have an order number beginning `TEST-DISPATCH-`; the two stock-race orders must individually fit the available stock but not both together. Supplier and technician profiles must meet the same active/availability conditions as production.

The runner leaves fixture orders assigned and stock reserved. Discard/reset the disposable database after the test. Never point this runner at production.

The normal CI suite also guards the harness's safety gates. It does not claim that the database-backed race tests ran unless a disposable database and fixtures were explicitly provisioned.

## 3. Performance observability and budgets

The app now reports sampled, privacy-safe Core Web Vitals for route groups:

- Customer
- Supplier
- Technician
- Admin
- Public

It also samples latency for the high-value API paths: customer order detail/tracking, supplier orders, technician jobs and admin dashboard reads.

Events are sent with `navigator.sendBeacon` to `/api/internal/telemetry/web-vitals` and emitted as structured stdout logs for Vercel runtime logs / configured log drains. The payload excludes full URL paths, query strings, order IDs, user IDs, names, email, phone and IP addresses. Telemetry is best-effort and must never block the request or navigation.

Targets:

| Measurement | Target |
|---|---:|
| LCP | ≤ 2,500 ms |
| INP | ≤ 200 ms |
| CLS | ≤ 0.10 |
| FCP | ≤ 1,800 ms |
| TTFB | ≤ 800 ms |
| Customer order detail API | ≤ 600 ms |
| Supplier orders API | ≤ 800 ms |
| Technician jobs API | ≤ 800 ms |
| Admin dashboard API | ≤ 1,000 ms |

These are engineering budgets, not measured production results. Use Vercel runtime logs or a configured log drain to aggregate p50/p75/p95 by `route_group` and metric/API group. Alert on p75 Web Vitals regressions and sustained API p95 budget breaches. Compare release windows before and after deploy.

Current GET coalescing remains in the API client; this work does not add broad caching. Mutations and abortable requests remain excluded from request coalescing. Do not cache order, payment, stock or dispatch state across users.

### What is not claimed

- No live RLS policy result is assumed until `db:inspect-live` has been run against the correct Supabase project.
- The concurrency runner has not run until a disposable database and test fixtures are supplied.
- The budgets are targets. Production p50/p75/p95 baselines require real traffic and log aggregation.
- This telemetry is not a replacement for distributed tracing or a dedicated error-monitoring platform. Connect Vercel log drains to the organisation's approved observability vendor when credentials and retention policy are ready.
