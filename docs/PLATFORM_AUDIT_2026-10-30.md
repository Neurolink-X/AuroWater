# AuroTap platform audit and next execution priorities — 30 October 2026

## Scope and evidence

Reviewed main at `03c6af921bde35efa108d18cc7ee9ede39bd5261`, recent merged PRs #118–125, both shared HTTP clients, authentication/rate limiting, telemetry intake, customer order writes, supplier payout requests, admin dashboard queries, security headers, dispatch scheduling configuration and migration inventory. The route regression suite covers 78 page routes; the source tree contains 97 API route files. This is a targeted source audit, not an exhaustive penetration test or live production certification.

Main's CI and CodeQL checks were successful at audit time. Merging a database migration is not evidence that it ran in production. Live database grants/RLS, payment reconciliation, supplier availability, scheduler health, restoration and real-user performance were not verified in this session.

## Changes in this branch

1. **Stop automatic replay of uncertain writes.** Both HTTP clients retried 503 responses; the legacy client also retried network failures for all methods. A committed order/stock write with a lost response could be sent again. The shared transport now retries only GET/HEAD, once. Explicit 401 session renewal remains in the authentication layer.
2. **Preserve authentication headers.** Spreading `Headers` instances into objects drops their entries. Normalize object/tuple/Headers inputs with `new Headers`, including refreshed access tokens.
3. **Bound stalled reads.** A 15-second total deadline covers response headers, body consumption and retry delays. Caller cancellation stops the request/backoff without a second attempt. Completed reads clear their timers/listeners; writes retain their previous runtime budget.
4. **Correct bundle coverage.** Next 16 webpack emitted no app-build manifest, so the old fallback measured only `/_app`. Read per-page client references with the route map, decode dynamic-segment paths and fail on missing chunks. The local build now reports 80 App Router entries; 41 exceed the existing informational budgets. These are conservative referenced-chunk totals (including lazy chunks), not initial transfer sizes or real-user speed measurements.
5. **Test runtime behavior.** Add 12 executable transport tests for mutation replay, network/503 read recovery, 401/429 handling, headers, credentials, cancellation and body-read timeouts. Replace a regression assertion on a comment with checks that both clients use the tested transport.

No schema, pricing, homepage layout, dispatch eligibility or payment settlement rules change. Existing GET coalescing and sampled timing events remain. This does not guarantee exactly-once writes: manual resubmission, other clients and concurrent requests still require server-side idempotency.

## Remaining blockers, in order

| Priority | Finding/evidence | Required work and completion evidence |
|---|---|---|
| P0 | Migration inventory fails: five numbered SQL files are absent from the explicit bundle, with overlapping numeric prefixes. | Compare live schema/grants and deployment history; reconcile dependencies, then prove a clean disposable environment can be built. Do not append by filename or rerun migrations blindly. |
| P0 | Login, password recovery and other routes use `src/lib/rate-limit.ts`, a process-local Map with no global enforcement. | Apply durable IP/account limits with hashed identifiers and defined dependency-outage behavior; verify across instances and restarts. Existing durable limiter helper alone does not prove every sensitive route is protected. |
| P0 | Customer order creation inserts without a request-idempotency contract. | Add a server-enforced user-scoped key plus payload hash, atomic uniqueness, replay response and conflict handling; test concurrent submissions and lost responses in staging. |
| P0 | Dispatch concurrency harness exists but no database-backed execution evidence is available. Scheduling is delegated to Supabase pg_cron; GitHub workflow is manual fallback. | Run fixture races on a disposable database. Verify cron heartbeat, >25-item backlog draining, exhausted retries and manual escalation in deployed environment. |
| P0 | Payout route delegates to `request_supplier_payout`; cash/UPI per-delivery paths are present. | Verify live RPC permissions, verified balance, parallel payout requests, collection evidence and settlement reconciliation. Do not describe UPI reference entry as gateway-confirmed payment. |
| P1 | Dashboard sums/charts fetch raw order rows without pagination (`src/app/api/admin/dashboard/route.ts`). | Replace with authorized SQL aggregates using a consistent Asia/Kolkata business-day boundary; test beyond the configured PostgREST row cap, compare against SQL totals and measure query plans. Current row-cap exposure risks incomplete figures as volume grows. |
| P1 | Web Vitals/API sampling exists; no production percentile baseline was retrieved. | Aggregate by route and release: p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; p95 API targets from the existing budget module. Measure login-to-home, tracking and provider/admin navigation on mobile. A timeout is a recovery bound, not a speed result. |
| P1 | CSP includes `unsafe-inline` and `unsafe-eval`; telemetry is public and accepts a client-provided navigation string. | Stage a nonce/report-only CSP rollout before enforcement; add telemetry ingress limits/strict navigation allowlists without making observability depend on expensive database writes. Validate OAuth and hydration. |
| P1 | Backup/restore and incident response evidence not available. | Rehearse restore into an isolated project, establish recovery objectives, alerts, deployment rollback and an assigned incident owner. |

Current unbundled files from `npm run db:audit-migrations`:

- `006_supplier_payout_lifecycle.sql`
- `007_auro_water_can_pricing.sql`
- `030_supplier_profile_change_requests.sql`
- `031_supplier_profile_address_fields.sql`
- `032_orders_cancel_reason_compat.sql`

The older database-verification guide lists four; today's inventory adds the pricing file to the reconciliation list. This is a source inventory discrepancy, not proof that production lacks those objects.

## Competitive priorities

Winning a local delivery market requires fulfilled orders, repeat customers and viable margins. More UI features alone are not evidence of a competitive advantage. Proposed operating targets should be calibrated from a real baseline:

1. Publish availability only when verified suppliers, stock, delivery capacity and service radius support it. Track fill rate, cancellations and unassigned-order age by locality.
2. Make repeat orders and subscription pause/skip/resume dependable. Build on existing subscription flows; avoid duplicate implementations.
3. Give realistic delivery windows, useful status changes and a clear support/escalation route. Do not invent live ETA or guarantees without tracking evidence.
4. Track quality complaints and resolution times, supplier reliability and verified quality evidence with expiry dates.
5. Measure contribution per completed delivery after supplier cost, refunds, support and payment fees. Preserve approved ₹20 normal / ₹25 chilled price floors.
6. Expand a locality only after delivery reliability, repeat rate and contribution support expansion. Treat Noida as its configured Sector 73 pilot, not citywide availability.

## Integrations and access

Use the existing GitHub checks and existing application telemetry first. Supabase and Vercel were connected during this audit. Supabase project discovery returned only an unrelated inactive project; requesting the known AuroWater project `mwfcwhxdlnqldciigicl` returned permission denied. Vercel listed `auro-water` but project inspection returned 403 requiring access to the `neurolinkxs-projects` team. A team-consent link was generated. Production inspection remains blocked by these specific provider permissions, not by missing installations. No new paid vendor, SDK, credentials or production configuration was added.

Vercel Observability/Speed Insights can provide production performance evidence. Use one error-monitoring/log destination when ownership and retention are agreed; adding several overlapping SDKs increases complexity. A new Redis/queue/vendor dependency is not automatically required: validate whether the existing Postgres durable controls meet measured load first.

References: https://vercel.com/docs/observability and https://vercel.com/docs/speed-insights .

## Validation

- Local lint: passed with existing warnings.
- Unit suite: 41 passed, including 12 new transport behavior tests and 2 bundle-report tests.
- Route/access/pricing/finance regression suite: passed (78 page routes).
- Migration inventory: failed with the five known reconciliation candidates above; no SQL applied.
- Production build: passed with placeholder CI configuration (no live database access).
- Bundle report: 80 route entries measured, 41 informational budget warnings; see conservative measurement caveat above.
- PR checks: record final results in the PR.
- Not executed: live database race tests, real payment/payout settlement, authenticated browser journeys, real-user speed measurements or restore drill.

Deploy the transport change through normal preview/CI review. Check order submission under response loss, expired-token recovery, cancelled navigation and slow API reads in preview. A failed write response is an uncertain outcome: inspect current order/payout state before manually resubmitting. Roll back the code commit if preview or production evidence identifies a regression; no database rollback is involved.
