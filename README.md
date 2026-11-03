# AuroTap (AuroWater)

> AuroTap is the customer PWA. AuroWater is the Next.js/Supabase platform behind bookings, dispatch, fulfillment, finance and administration.
>
> **Docs audited: 3 November 2026.** Code merged into GitHub does not mean it is deployed, its database migration has been applied, or its feature flag has been enabled. Do not claim tested 100,000-user capacity without a staging end-to-end load test.

AuroWater is a production-oriented marketplace platform designed to connect customers with water suppliers and field technicians through a single digital workflow.

The platform combines customer booking, serviceability, pricing, order tracking, supplier dispatch, technician dispatch, inventory-aware water fulfillment, OTP-based service verification, payment confirmation, reviews, operational dashboards, and role-based administration.

**Consumer experience:** AuroTap  
**Primary stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · Supabase  
**Repository:** Neurolink-X/AuroWater  
**Primary production domain:** aurotap.in

---

## Product overview: every important workflow

AuroTap serves two business models: **water delivery** and **local home water-system services**. Customer discovery, booking, operational fulfillment and admin management belong to the same Next.js / Supabase application.

## Core services and actual fulfillment

| Service | Customer flow | Fulfillment requirement |
|---|---|---|
| 20L RO water can (Normal and Chilled) | Address, quantity, delivery slot, checkout, tracking | Eligible local supplier with approved coverage and stock |
| Water tanker | Select volume/options, request confirmation or quote where needed | Suitable supplier, volume readiness, valid quote before any custom payment |
| RO service, filters, installation | Select service/options, address and appointment | Approved local specialist with capabilities and availability |
| Plumbing, borewell, motor/submersible pump and tank cleaning | Choose specialist service, location and schedule | Approved technician/plumber serving the same customer area |

Server-side eligibility and effective-date published pricing govern order creation. A UI card or marketing price alone is not evidence that an order can be fulfilled.

## Role-by-role product features

| Role | Core features | Server-side protection |
|---|---|---|
| Customer | Login/Google auth, saved addresses, booking wizard, orders, live tracking, subscriptions, reviews, loyalty/referrals, notifications and support | User-owned records, address validation, published price, duplicate protection |
| Supplier | Verification, stock/online state, approved PIN coverage, dispatch offers, accept/reject, service updates, earnings/payouts, referrals | Active/approved state, stock and local assignment checks |
| Technician / plumber | Application, documents, service skills, locality and radius, availability, jobs, acceptance, OTP, completion and earnings | Approved credentials and matching same-city service coverage |
| Admin | Settings, pricing versions, city/zone expansion, approvals, finance, orders, dispatch/queue health, intelligence, content and auditing | Admin auth, auditability and privileged action validation |

Account registration does **not** automatically establish operational approval.

## Cities and operating coverage

**Kanpur, Lucknow, Noida and Gorakhpur** are represented in code. The **active database city/zone configuration**, actual supplier coverage and eligible local professional capacity determine what can be booked at any given address. A plumber based in Gorakhpur must not be offered a Kanpur booking just because both cities are configured. Location fallback must never bypass the authoritative serviceability checks.

## Pricing, payments, subscriptions and finance

- Published, effective pricing versions must agree across public landing/service pages, booking, checkout and server order validation, including city overrides.
- Current code checks minimum configured Normal RO **₹20/20L** and Chilled RO **₹25/20L**. Chilled recurring subscriptions are disallowed.
- Current default water-can caps: **50** in a one-time order and **200** for a recurring delivery; authorized settings and server validation determine live caps.
- Dynamic option charges, convenience/delivery fees, emergency charges and tax are validated server-side; legacy admin settings do not supersede effective published prices.
- Recurring subscriptions require deduplicated delivery generation, pause/resume concurrency safety, matching supplier eligibility and payment/reward synchronization.
- COD/UPI manual confirmation is not equivalent to a reconciled payment-gateway settlement. Wallet ledger, payouts, payment state and order completion must remain consistent and auditable.

## Marketing, trust and customer support

Service/area landing pages, real customer reviews, blogs, FAQ, service contact details and social links support discovery. Admin-managed content must not block customer booking or make unverifiable claims about rankings, market prices or current coverage.

---

# Architecture

## High-level architecture

~~~text
                         ┌──────────────────────┐
                         │      Customer        │
                         │   Web / PWA / Mobile │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Next.js 16      │
                         │   App Router + API   │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
      ┌─────────────┐       ┌──────────────┐       ┌──────────────┐
      │ Auth / RBAC │       │ Domain Logic │       │ Public / SEO │
      │ + Proxy     │       │ Dispatch     │       │ Pages / PWA  │
      └──────┬──────┘       └──────┬───────┘       └──────────────┘
             │                      │
             └──────────────┬───────┘
                            ▼
                   ┌──────────────────┐
                   │     Supabase     │
                   │ Auth + Postgres  │
                   │ RLS + RPC + Cron │
                   └────────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         ┌─────────┐   ┌──────────┐   ┌──────────┐
         │Supplier │   │Technician│   │  Admin   │
         │workflow │   │ workflow │   │ control  │
         └─────────┘   └──────────┘   └──────────┘
~~~

### Security boundary

The browser is a UX layer, not the authorization authority.

The intended trust model is:

~~~text
Browser
   ↓
Next.js API / server logic
   ↓
Authenticate identity
   ↓
Validate role + account state
   ↓
Validate operational eligibility
   ↓
Validate resource ownership/state
   ↓
Supabase / PostgreSQL / RLS
   ↓
Atomic business operation
~~~

Client-side auth state, local storage, and routing cookies must never be treated as proof of authorization.

---

# Technology stack and repository layout

| Layer | Current repository |
|---|---|
| Framework | Next.js **16.4.3** App Router on Vercel |
| UI | React **19.3.1**, TypeScript, Tailwind CSS 4 |
| Components | Lucide, Sonner, Framer Motion, React Hook Form, Zod |
| Auth and data | Supabase Auth, PostgreSQL, RLS, trusted server APIs, atomic RPCs |
| Scheduled operations | Supabase pg_cron/pg_net and protected worker API routes |
| PWA/SEO | Service Worker, manifest, offline page, JSON-LD, sitemap, robots, Open Graph |
| Quality | GitHub Actions, CodeQL, ESLint, unit/regression, database and preview checks |

~~~text
src/app/(public)/          Marketing, service discovery and booking
src/app/customer/          Customer home, orders, subscriptions and account
src/app/supplier/          Supplier operational dashboard and coverage
src/app/technician/        Technician dashboard and jobs
src/app/plumber/           Specialist-specific flow
src/app/admin/             Admin settings, orders, finance, pricing and dispatch
src/app/api/               Public, role-authenticated and internal APIs
src/components/            Shared layout, booking, role UI, PWA and telemetry
src/hooks/                 Auth, settings, orders and live role updates
src/lib/                   Business rules, pricing, dispatch and database helpers
src/proxy.ts               App route gating (not the ultimate auth boundary)
supabase/migrations/       Timestamped database migrations
sql/                      Legacy numbered migrations and generated bundle
scripts/                  Audits, benchmarking, health and regression tooling
tests/                    Automated tests and integration guardrails
public/                   Images, manifest, service worker and SEO assets
docs/                     Operational, security and performance runbooks
.github/workflows/         CI, security analysis and manual fallback workflows
~~~

Old modules and compatibility paths are present; their age alone does not prove they are unused or broken. Verify imports, deployed traffic and tests before removing them.

---

# Request and routing model

AuroWater uses Next.js App Router with a dedicated request proxy.

The proxy is responsible for:

- Public/SEO route handling
- Private route gating
- Role-aware browser routing
- Admin authentication separation
- Smart dashboard routing
- API pass-through so APIs can return JSON 401/403 responses
- Return-to sanitization
- Security headers
- Static asset bypasses

Important:

**Proxy cookies are routing signals, not the final security boundary.**

Sensitive API handlers independently authenticate requests and should enforce authorization and ownership.

---

# Authentication and authorization

The platform has four primary roles:

~~~text
customer
supplier
technician
admin
~~~

Account lifecycle and operational eligibility are separate concepts.

A role does not automatically mean operational access.

For example:

~~~text
supplier
   +
active account
   +
approved/eligible operational state
   =
supplier can receive production work
~~~

The same principle applies to technicians.

The repository's authentication documentation follows this rule:

> The UI may hide an action. The server must prevent the action. The database must enforce the data boundary.

---

# Order and dispatch architecture

## Water order flow

~~~text
Customer
  ↓
Address + serviceability
  ↓
Pricing
  ↓
Create PENDING order
  ↓
Supplier dispatch engine
  ↓
Eligible supplier ranking
  ↓
Atomic stock-aware assignment
  ↓
Supplier acceptance
  ↓
Delivery
  ↓
Completion / payment state
  ↓
Review
~~~

The supplier assignment RPC locks the relevant order/stock state so concurrent assignment attempts do not casually oversell available inventory.

The application uses an order dispatch history table to track supplier assignment attempts and states.

---

## Technician order flow

~~~text
Customer service booking
  ↓
PENDING order
  ↓
Technician candidate ranking
  ↓
Atomic technician assignment
  ↓
OFFERED
  ↓
Technician accepts
  ↓
ACCEPTED
  ↓
IN_PROGRESS
  ↓
OTP / service proof when required
  ↓
Payment confirmation
  ↓
COMPLETED
~~~

The technician system includes atomic database functions for assignment, acceptance, start, release, OTP verification, and completion.

This protects critical state transitions from race conditions between multiple requests or scheduler runs.

---

# Automated recovery, bounded queue and capacity (PR #243)

**PR #243 was merged on 3 November 2026, but its durable queue defaults to OFF.** Existing supplier/technician retries continue to operate while it is disabled. The new queue cannot be called live merely because the pull request is merged.

## Explain it simply

A pending order enters a small, database-backed queue entry. A worker temporarily claims it, checks real provider eligibility and stock using the existing atomic dispatch logic, and removes the entry when assigned or completed. If a provider is temporarily unavailable, recovery retries after a delay. If repeated internal errors prevent dispatch, the queue records a dead letter for admin investigation rather than deleting the customer's order.

The new design includes:

- A single idempotent work item per order UUID; no copied customer address, phone or payment payload
- Database row locking, lease tokens, a shared in-flight cap and retry backoff
- Stale-lease recovery, controlled dead-letter requeue and a reconciliation sweep
- Admin monitoring at **/admin/dispatch-queue** with Ready / In progress / Needs review and aging pending orders
- An optional shared checkout admission limiter when the queue is ON; overloaded new bookings receive **429 + Retry-After**; unavailability of the admission check fails safely with **503** before order/payment creation
- Existing checkout UUID replay checked before new-booking admission, protecting legitimate retries
- Flag-based rollback to legacy retry without deleting order, payment, stock or payout records

Supplier and technician background jobs still require internal secret authorization. The new queue is **not** a replacement for normal synchronous booking or atomic supplier/technician assignment.

## Min / max: actual limits in merged code

| Constraint | Minimum / normal default | Maximum in current code | Important caveat |
|---|---|---|---|
| Queue feature flag | OFF by default; zero new queue worker calls when OFF/idle | Enabled only after release gates | Legacy retry remains active when OFF |
| New checkout admission when queue ON | Valid configured value **1 booking/min**; default **48/min** | Input clamped to **3,000/min** | 3,000 is a configuration ceiling, **not certified safe capacity** |
| Items per worker HTTP invocation | 0 if queue empty | **32 claims per call** | Runtime budget and supply may reduce this |
| Parallel assignment work per worker | 0 when idle | **3 concurrent dispatches** | Local to an instance |
| Shared leased jobs across workers | 0 when idle | **24 simultaneous leases** | Enforced by the database |
| Supabase scheduler | 0 calls when disabled or no due work | **4 worker calls per 2 minutes** | Depends on the installed migration and successful cron/HTTP execution |
| Theoretical claim rate | 0 when OFF/idle | **128 claims/2 min = 64/min = 3,840/hour** | Ideal arithmetic ceiling; **not** guaranteed successful order assignments |
| Individual queue lease | **90-second default** | Database clamp **60–180 seconds** | Retry/lease duration, not customer booking SLA |
| Isolated synthetic queue benchmark | **100 test records** | **100,000 test records** | Synthetic DB mechanics only; no production customer load |

**Example:** Even at an unrealistic perfect 64 successful, distinct first-try claims per minute, 100,000 waiting orders would require **more than 26 hours** to be touched once. Provider unavailability, retry attempts, serverless scheduling and DB/network constraints can make the real time longer. This design **does NOT certify 100,000 simultaneous users/bookings**.

**The current minimum and maximum safe number of concurrent users is UNKNOWN** because the system lacks a verified, representative full-stack load test. Homepage visits, browsing users, checkout writes and dispatch assignments are different workloads and must not share one invented capacity figure.

**Documentation correction:** PR #243's summary once said 16 claims/minute. The reviewed migration defines up to **4 × 32 claims every two minutes**, which yields the **64/minute theoretical upper bound** above. It must not be confused with real measured throughput. Raising booking admission alone creates backlog unless measured queue capacity scales with it.

## Activation and safety gates

Do not enable the flag in production until all of these are verified:

1. Apply/reconcile the reviewed timestamped migration in an isolated environment; validate global leases, RLS, idempotency and safe rollback.
2. Complete SQL concurrency checks and duplicate checkout, supplier stock and specialist-offer race tests.
3. Run staging browser E2E for customer booking → supplier/specialist dispatch → payment and completion.
4. Observe database CPU/connections, worker errors, claim and **successful assignment** rate, backlog age, dead letters, API p95/p99 and 429/503 rates.
5. Verify the **CRON_SECRET**-authenticated endpoint, cron job installation, reconciliation and backfill of every pre-existing eligible PENDING order.
6. Use a monitored low-volume canary. Never run a 100k test against production or enable new paid resources without approval.

The migration refuses enabling the queue with an incomplete pending-order backfill. For larger backlogs, authorized service-role operators must prefill in bounded batches before activation. Roll back by setting **dispatch_work_queue_enabled=false**; do not delete the queue, order, ledger or audit history.

See [Durable queue release gates](docs/DURABLE_DISPATCH_SCALE_RELEASE_GATES.md), which also documents a **disposable, explicitly opt-in** database benchmark.

## Existing scheduler and Vercel

When queue mode is OFF, existing legacy retry paths remain responsible for pending orders and stale technician-offer recovery continues. The queue mode uses **Supabase pg_cron / pg_net** for conditional worker invocations. Vercel runs the Next.js app/API, including the authenticated internal endpoint; the **vercel.json** subscription cron remains a separate job.

GitHub Actions is not an unlimited autoscaling worker pool. A script with a 100,000-item mock simulation is not a live load test.

---

# Database architecture

Supabase PostgreSQL is the system of record.

Important domain areas include:

- profiles
- addresses
- service_types
- orders
- order_dispatch
- technician_job_dispatch
- notifications
- settings
- applications
- reviews
- payouts
- fraud_flags
- audit_logs
- supplier_settings
- plumber_bookings
- founding_members
- supplier_stock
- OTP/request security data
- login attempt data
- subscription/milestone/referral data

The production schema contains atomic PostgreSQL functions for critical operations instead of relying exclusively on multi-step client/API updates.

---

# Row Level Security

RLS is a required part of the security model.

Examples of ownership boundaries include:

~~~text
Customer
  → customer-owned addresses/orders/data

Supplier
  → supplier-authorized operational records

Technician
  → assigned/authorized job records

Admin
  → trusted elevated operational access
~~~

Do not assume a browser-supplied customer_id, supplier_id, technician_id, or role is trustworthy.

Authorization must be derived from the authenticated identity and trusted database state.

---

# Address and serviceability model

Customer addresses are owned through customer_id.

This distinction matters because the production addresses table uses:

~~~text
customer_id = authenticated user's profile/auth identity
~~~

rather than a generic user_id ownership field.

Water delivery also depends on valid serviceability/location information. The customer order API requires a valid delivery location for water-can orders.

This prevents dispatch from being attempted against an unusable delivery location.

---

# Pricing and payment model

Pricing is server-aware and booking/order creation should not rely solely on a browser-calculated total.

Water-can ordering supports:

- quantity
- one-time ordering
- recurring/subscription ordering
- scheduled delivery
- payment method
- payment status
- delivery/address data
- pricing components

Payment status currently supports:

~~~text
pending
unpaid
paid
refunded
failed
~~~

Operational completion can require payment confirmation and, for applicable UPI flows, a payment reference.

There is currently no requirement for a full third-party payment gateway in the core operational flow.

---

# PWA, SEO, UX and performance

## PWA and offline reliability

The site provides installable AuroTap branding, service-worker registration, a manifest, offline fallback and disposable-cache housekeeping. Safe offline caching is limited to suitable public/static assets. Never publicly cache authenticated order, supplier, admin, financial or personalized API responses, and never show an expired price version as current.

## Search engine optimization

Public city/service pages, blog/knowledge content, canonical metadata, Open Graph, robots, sitemap and JSON-LD support discovery. Private login, account, checkout, order and admin flows must not be indexed as public marketing content. Preview/staging URLs must not become duplicate production search results.

## Speed and latency targets

Targets are engineering budgets, **not measured customer experience or capacity guarantees**:

| Metric | Budget |
|---|---:|
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.10 |
| FCP | ≤ 1.8s |
| TTFB | ≤ 800ms |
| Customer order detail API | ≤ 600ms |
| Supplier orders API | ≤ 800ms |
| Technician jobs API | ≤ 800ms |
| Admin dashboard API | ≤ 1,000ms |

The platform samples privacy-safe performance telemetry by role. Measure real mobile startup, navigation, initial JS, long animations, concurrent dashboard API calls, database locks, query plans and p95 latency before claiming an improvement. Use realtime updates and bounded fallback polling rather than constantly reloading entire dashboards.

Read **docs/DATABASE_DISPATCH_PERFORMANCE_VERIFICATION.md**, **docs/RESILIENCE_SPEED_SEO_RUNBOOK.md** and **docs/mobile-performance-verification.md**.

---

# Security controls

The project currently includes multiple defense layers:

- Supabase Auth
- Server-side authentication helpers
- PostgreSQL RLS
- Role-aware proxy routing
- Resource ownership checks
- Atomic PostgreSQL RPCs
- Service-role isolation
- CRON_SECRET-protected internal scheduler endpoint
- HSTS
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- CSP
- X-Frame-Options
- Open-redirect protection for returnTo
- Production console removal
- Restricted image remote patterns
- API no-store caching through Vercel configuration

Security principle:

**Fail closed when authentication, ownership, or operational eligibility cannot be established.**

---

# Performance architecture

The application is being optimized incrementally rather than through a risky rewrite.

Current principles:

- Keep server-renderable content server-side where safe
- Minimize unnecessary client hydration
- Keep sensitive data uncached
- Use database indexes for high-frequency dispatch queries
- Bound scheduler work
- Use atomic database operations for concurrency-sensitive flows
- Keep the service worker lightweight
- Use modern image formats
- Remove production console output
- Avoid unnecessary infrastructure

Recent safe optimization:

The static Footer was converted away from unnecessary client hydration and its duplicate Google Fonts import was removed without changing its visual markup or behavior.

Future optimization targets should be audited independently, especially the interactive Header and customer dashboard.

---

# Environment configuration

Create a local environment file from .env.example.

Required core variables:

~~~text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
~~~

The application also supports the publishable-key naming used by newer Supabase dashboards.

Optional operational variables include configuration for:

- Google Maps/geocoding
- admin invitation/access controls
- support contact details
- database connection
- application URL behavior

Never expose SUPABASE_SERVICE_ROLE_KEY or other server secrets through NEXT_PUBLIC_* variables.

---

# Local development

## Requirements

Recommended:

- Node.js 20+ (compatible with the pinned Next.js release)
- npm
- Supabase project or development database
- Git

## Install

~~~bash
git clone https://github.com/Neurolink-X/AuroWater.git
cd AuroWater
npm ci
~~~

Create .env.local and configure the required variables.

Validate environment configuration:

~~~bash
npm run verify:env
~~~

Start development:

~~~bash
npm run dev
~~~

Then open:

~~~text
http://localhost:3000
~~~

---

# Quality checks

Available project commands:

~~~bash
npm run lint
npm run build
npm run test:regression
npm run smoke
npm run smoke:auth
npm run verify:env
npm run db:bundle-sql
~~~

### Regression test

The route/access regression test checks for:

- duplicate App Router URLs
- supplier route protection invariants
- proxy route structure

Run:

~~~bash
npm run test:regression
~~~

### Public smoke test

Against a running local instance:

~~~bash
BASE_URL=http://localhost:3000 npm run smoke
~~~

### Authenticated smoke test

Use a dedicated development Supabase account only.

~~~bash
BASE_URL=http://localhost:3000 \
SMOKE_TEST_EMAIL=dev-smoke@example.test \
SMOKE_TEST_PASSWORD='your-development-password' \
SMOKE_EXPECTED_ROLE=customer \
npm run smoke:auth
~~~

The authenticated smoke test reads the development user's profile/address data and intentionally submits an invalid order payload. It should return HTTP 400 and create no order.

**Never point this test at production.**

---

# Database migrations

Legacy numbered migration sources exist under sql/. **New timestamped, reviewable migrations also live in supabase/migrations/** (including PR #243). A live deployment must reconcile both tracks with the actual production schema before applying anything. The generated legacy bundle is **not** a complete snapshot of all current timestamped migrations.

The older ordered bundle is:

~~~text
sql/ALL_MIGRATIONS_ORDERED.sql
~~~

The repository also provides:

~~~bash
npm run db:bundle-sql
~~~

to regenerate the ordered bundle from the migration sources included by the migration builder.

## Important migration audit note

**Do not blindly replay sql/ALL_MIGRATIONS_ORDERED.sql in an existing production database.** Its historical scope cannot substitute for complete schema and migration-history reconciliation. Run **npm run db:audit-migrations**, inspect the current production schema, review timestamped Supabase migrations and apply only planned, verified changes. Queue mode stays OFF until its SQL, authorization, backfill, cron and staging workflows pass.

After DDL changes, reload PostgREST:

~~~sql
SELECT pg_notify('pgrst', 'reload schema');
~~~

For production schema changes:

1. Audit the live schema first.
2. Create an idempotent migration.
3. Test it on a development/staging database where possible.
4. Apply it deliberately.
5. Reload PostgREST when required.
6. Verify the live schema.
7. Run relevant smoke/regression checks.
8. Record the resulting commit and migration state.

---

# Deployment

The current deployment model is intentionally simple:

~~~text
GitHub
   ↓
Vercel
   ↓
Next.js application
   ↓
Supabase
   ├── Auth
   ├── PostgreSQL
   ├── RLS
   ├── RPC
   └── pg_cron / pg_net
~~~

See DEPLOY.md for the operational deployment runbook.

Production deployment should verify:

- environment variables
- database migrations
- PostgREST schema visibility
- public SEO routes
- authentication
- customer booking
- address/serviceability
- supplier dispatch
- technician dispatch
- role protection
- scheduler authentication
- no leaked service-role credentials

---

# Internal scheduler security

The technician dispatch sweep is an internal server endpoint.

It requires:

~~~text
Authorization: Bearer <CRON_SECRET>
~~~

The proxy allows the endpoint to reach its own route handler without converting the request into a browser login redirect.

The route itself validates CRON_SECRET.

This separation is deliberate:

~~~text
Proxy routing exception
        ≠
Authorization bypass
~~~

The scheduler route remains server-secret protected.

---

# Operational reliability

Critical dispatch operations are designed around idempotency and concurrency safety.

Important patterns include:

- atomic supplier assignment
- stock reservation within the assignment transaction
- atomic technician assignment
- explicit offer/release states
- bounded retry intervals
- scheduler runtime limits
- indexed pending/stale work queries
- server-side role/ownership checks
- explicit order state transitions

The goal is to make repeated scheduler execution safe rather than assuming a scheduler will run exactly once.

---

# Observability and diagnostics

The project has lightweight startup diagnostics through Next.js instrumentation.

It can detect missing Supabase configuration and optionally emit Supabase/PostgREST migration diagnostics.

Production logging is intentionally reduced through the Next.js production console-removal configuration.

For future scale, recommended additions include:

- structured server logging
- request correlation IDs
- error tracking
- performance telemetry
- scheduler execution metrics
- dispatch latency metrics
- assignment failure reasons
- business-level operational dashboards

These should be introduced based on actual production requirements rather than adding unnecessary services prematurely.

---

# Documentation map

| Document | Purpose |
|---|---|
| README.md | Product, architecture, development, operations overview |
| DEPLOY.md | Deployment and Supabase operational runbook |
| CLAUDE.md | Agent/developer-specific repository context |
| .env.example | Safe environment-variable template |
| sql/ | Database migration source |
| sql/ALL_MIGRATIONS_ORDERED.sql | Generated ordered SQL bundle |
| supabase/migrations/ | Timestamped schema changes; includes the guarded dispatch queue SQL |
| scripts/ | Verification, smoke tests and migration tooling |
| tests/ | Regression tests |

---

# Current engineering risks and production release gates

| Priority | Area | Required evidence, not just merged code |
|---|---|---|
| P0 | Migration history | Reconcile legacy numbered and timestamped migrations with actual production schema; prove clean disposable DB setup |
| P0 | Reliability at scale | Measure staging bookings/second, successful assignments/minute, queue backlog, DB locks/connections and p95/p99 |
| P0 | Security | Review account bootstrap, credential rotation, authorization, RLS and abuse protection across all entry points |
| P0 | Transaction correctness | Verify order idempotency, stock races, subscription duplicate prevention, payment/ledger and payout reconciliation |
| P1 | Customer/order speed | Eliminate redundant polling and stale responses; measure initial page and live tracking |
| P1 | Legacy APIs and modules | Trace imports/traffic, consolidate duplicate pricing paths carefully and remove only verified dead code |
| P1 | Query efficiency | Replace unbounded dashboard row scans with verified indexed aggregates; compare SQL counts |
| P1 | Frontend performance | Reduce client-side JS and animation cost without removing useful workflows or degrading UI |
| P1 | Incident readiness | Verify cron heartbeat, Vercel deployment, logs, backups/restoration and rollback |
| P2 | SEO/content claims | Verify published city/service/pricing content, schema, canonical URLs and search coverage |

**Historical DB retention snapshot:** The 3 November 2026 runbook reported about 93 MB total allocated PostgreSQL data and ~55 MB public application tables; it is not a concurrent-user benchmark. PIN staging and active directories contain different curated content even when counts match. Never delete them, business records, ledger, pricing history, audit logs or customer data to chase cache/memory improvements. See **docs/DB_RETENTION_RUNBOOK_2026-11-03.md**.

To improve speed, focus on demonstrated bottlenecks, measure before/after, keep CI green and perform staging tests. A stale file timestamp is a clue for review, not proof that editing it will improve performance.

---

# Aging-file audit: update what actually affects the application

**File age alone is not a performance problem.** Compare source change history, current imports, API traces, actual queries, mobile browser profiler, CI and error logs before touching a file. Replacing a long-standing but correct utility may worsen stability. Audited path history as of 3 November 2026:

| Path | Last source change found | Finding and next step |
|---|---|---|
| src/lib/db/connection.ts | 22 Apr 2026 | Legacy PostgreSQL helper still used by old pricing/bootstrap modules. Do not increase connection pool blindly. Trace live imports and remove obsolete use of database fallback pricing after verification. |
| src/lib/i18n/LanguageContext.tsx | 1 Sep 2026 | Language provider runs in the root layout; test font swapping and hydration. Only optimize if profiling shows render/layout cost. |
| src/components/layout/SiteNav.tsx | 1 Sep 2026 | Old alternate navigation implementation with dynamic style and font import. Search found no active importing site layout; do not refactor until actual usage/dead-code proof. |
| src/components/layout/AnnouncementBar.tsx | 1 Sep 2026 | Old announcement banner with hardcoded founding-member claim. Verify active import and claim accuracy before showing or deleting. |
| src/hooks/useAuth.ts | 6 Oct 2026 | Large central compatibility hook; security-sensitive. Profile auth listener/session refresh and cross-tab events rather than rewriting. |
| src/hooks/useCustomerOrders.ts | 6 Oct 2026 | Redundant 15-second polling continued while live updates connected. Isolated request-reduction change is proposed separately in PR #245, not proven in production. |
| src/lib/api/settings-map.ts | 12 Oct 2026 | Legacy settings mapper still exists. Validate against published pricing contract before consolidating duplicate configuration. |
| src/app/api/cron/dispatch-sweep/route.ts | 12 Oct 2026 | Historical cron endpoint. Confirm actual scheduler integration and avoid simultaneous overlapping dispatch jobs. |

**Recently updated critical paths:** Header, homepage, booking, supplier/technician dashboards, API transport and PWA service worker saw source changes on 1–3 November 2026. Their speed still needs live measurements; recency is not proof of correctness.

**High-value fix strategy:** optimize authenticated order polling, slow database query plans, LCP/client hydration and duplicate requests with before/after measurements; preserve financial, booking and provider status consistency. Verify standalone retired modules before pruning and do not globally ignore or delete historical business data.

The **.gitignore** was intentionally left unchanged after clarifying that “ignored files” meant neglected source modules rather than Git ignore patterns. It does not control runtime latency.

---

# Engineering principles

AuroWater development follows these rules:

1. **Audit before modifying.**
2. **Prefer the smallest safe change.**
3. **Never replace working architecture without evidence.**
4. **Do not trust browser state for authorization.**
5. **Do not assume database column names; verify the live schema.**
6. **Use atomic database operations for concurrency-sensitive business logic.**
7. **Keep public SEO pages separate from private application workflows.**
8. **Do not cache sensitive authenticated data as public content.**
9. **Keep scheduled work bounded and retryable.**
10. **Preserve backward compatibility unless there is a verified reason to break it.**
11. **Validate production changes with tests and live-state verification.**
12. **Avoid infrastructure complexity until the workload justifies it.**

---

# Known repository maturity items

The current repository is production-oriented, but it is not represented as a mature enterprise engineering organization yet.

The audit identified these areas for continued verification and improvement:

- Keep the existing GitHub Actions checks mandatory; fix lint, type/build, regression and security failures before merge.
- Verify PR-required checks and production deployment separately from a successful merge.
- Add dedicated integration/e2e coverage for critical booking and dispatch flows.
- Add a formal SECURITY.md security reporting policy.
- Add CONTRIBUTING.md and CODE_OF_CONDUCT.md if the repository becomes externally collaborative.
- Establish a formal staging environment and database migration promotion process.
- Keep generated migration bundles synchronized with every new migration source.
- Reduce large legacy commented blocks in frequently loaded source files.
- Continue reducing unnecessary client-component hydration.
- Add structured production observability before operational scale makes debugging expensive.

These are maturity improvements, not reasons to rewrite the existing product.

---

# Roadmap

## Near term

- Strengthen CI/CD verification
- Complete migration-tooling consistency
- Continue client-hydration/performance audit
- Expand critical API regression coverage
- Improve dispatch observability
- Strengthen production smoke verification

## Medium term

- Real-time order/dispatch updates where justified
- Better supplier inventory forecasting
- Technician quality scoring and operational analytics
- Stronger fraud/risk controls
- Structured telemetry and error monitoring
- Staging-to-production migration workflow

## Scale phase

- Distributed caching where proven necessary
- Real-time event infrastructure where polling becomes insufficient
- More advanced dispatch optimization
- Regional operational expansion
- Deeper supplier/technician marketplace automation

---

# Contributing

For internal development:

1. Start from the latest main branch.
2. Audit the affected implementation before editing.
3. Make the smallest safe change.
4. Run relevant tests.
5. Verify the exact diff.
6. Document schema/migration changes.
7. Open a focused pull request.
8. Do not mix unrelated refactors with production fixes.

Avoid large rewrites of authentication, dispatch, database state transitions, or role systems without a migration plan and regression coverage.

---

# Production change checklist

Before merging a production-sensitive change:

~~~text
[ ] Current main audited
[ ] Live schema verified when DB-related
[ ] Existing API/UI behavior understood
[ ] Smallest safe change implemented
[ ] No secrets added
[ ] Type/lint/build checks run
[ ] Relevant regression tests run
[ ] Migration generated/applied if required
[ ] PostgREST refreshed if required
[ ] Exact diff reviewed
[ ] Deployment impact understood
[ ] Rollback path understood
~~~

---

# Project status

AuroWater is an actively developed production-oriented platform.

The repository prioritizes:

**reliability → security → correctness → performance → UX → scale**

The engineering objective is not to maximize architectural complexity. It is to build a dependable water-delivery and home water-services marketplace that can scale operationally while keeping the customer experience fast and simple.

---

## License

No repository-level open-source license file is currently declared.

Until an explicit license is added, treat the repository and its source code as proprietary and do not assume permission to redistribute or reuse it.

---

## AuroWater

**Water delivery and essential water-system services, connected by software.**

Built with Next.js, React, TypeScript, Supabase, PostgreSQL, and a strong focus on operational reliability.
