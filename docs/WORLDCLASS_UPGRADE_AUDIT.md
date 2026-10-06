# AuroWater World-Class Upgrade — Architecture Audit & Delivery Plan

Branch: `worldclass-platform-upgrade`
Baseline: `main` at audit start (2026-10-06)

## 1. Executive verdict

AuroWater has a strong product skeleton: Next.js App Router, Supabase/Postgres, role-based access, serviceability, pricing, dispatch, realtime supplier orders, subscriptions, admin operations and PWA support.

It is **not yet a world-class production marketplace** because the highest-risk gaps are in state ownership and financial/operational consistency rather than visual design.

Current production-readiness estimate:
- Auth/RBAC: 8/10
- Customer ordering: 8/10
- Dispatch architecture: 7/10
- Supplier acceptance: 4/10
- Supplier workspace: 4/10
- Inventory: 3/10
- Fleet operations: 2/10
- Supplier pricing: 3/10
- Earnings: 3/10
- Payouts: 2/10
- Subscriptions: 6/10
- Overall supplier-network readiness: ~4.5/10

## 2. Current architecture map

### Customer
- Public service discovery
- Booking wizard
- Address/serviceability
- Server-side order creation
- Order tracking/history
- Water subscriptions
- Reviews/notifications

### Supplier
- Supplier dashboard
- Supplier orders
- Online/offline setting exists in database but is not fully wired to the workspace
- Accept/reject APIs exist
- Stock API exists
- Earnings API exists
- Payout APIs exist but the dashboard currently uses an intent-only endpoint

### Technician
- Job queue, accept/status, technician earnings/profile

### Admin
- Dashboard, users, orders, finance, pricing, services, settings, zones

### Platform services
- Supabase Auth/RLS
- Dispatch engine
- Pricing helpers/engine
- Notifications
- Realtime orders
- Cron for subscriptions
- PWA manifest/robots/sitemap/JSON-LD

## 3. P0 production blockers

### P0-A — Supplier availability
Dispatch selects suppliers from `supplier_settings.is_online = true`, but the supplier settings API does not currently accept `is_online`. This can leave a supplier permanently ineligible.

### P0-B — Order state machine
Formal accept/reject endpoints exist, but the supplier dashboard directly moves orders to `IN_PROGRESS`. There are also two status APIs with inconsistent transition rules.

Target:
`PENDING -> ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED`

Reject/timeout:
`ASSIGNED -> PENDING -> next supplier`

### P0-C — Global dispatch recovery
Expired offers and pending orders are primarily repaired lazily from customer-facing requests. Production needs a scheduled dispatch sweeper so a customer does not have to open a page to make operations recover.

### P0-D — Inventory integrity
Stock is deducted at completion and the current manual read-then-write path is race-prone. A supplier can receive more work than available stock.

Target:
- available stock
- reserved stock
- atomic reserve/release/consume
- dispatch/acceptance eligibility tied to stock

### P0-E — Supplier earnings and payouts
`supplier_payout` exists in orders, but the current order pipeline does not have one obvious authoritative calculation path. The dashboard payout request endpoint returns success without persisting a payout request, while the separate payouts endpoint is constrained by current RLS.

Target:
- immutable order financial snapshot
- persistent payout-request record
- atomic balance reservation
- admin/finance processing state
- idempotency

### P0-F — Pricing/GST consistency
Customer order creation currently uses GST rate 0 while platform settings seed an 18% GST value. Subscription orders inherit the stored rate. This creates inconsistent financial behavior.

Target:
- one server-authoritative pricing calculation
- one GST setting
- exact order price snapshot
- client values used only for presentation/validation

### P0-G — Subscription advancement
The recurring job advances `next_order_date` even when dispatch may not have found a supplier. A missed delivery must remain recoverable instead of silently consuming the recurrence.

## 4. P1 product/platform upgrades

- Server-backed supplier profile, pricing, fleet and documents
- Supplier working hours and capacity
- Direct AuroTap-ID routing
- Real document upload/verification
- Bank/UPI account management
- Customer notifications + realtime operational events
- Admin exception queue for stuck orders
- Business/bulk account workflow
- Better analytics and supplier performance score
- Subscription pause/resume/edit/retry policy
- Audit trail for state and finance actions

## 5. SEO audit

Current strengths:
- Next.js Metadata API
- robots.ts
- sitemap.ts
- Organization/WebSite JSON-LD
- canonical URLs on several public layouts
- social OG/Twitter metadata
- PWA metadata

Current weaknesses:
- Sitemap contains several URLs that do not exist in the current route tree.
- `src/lib/seo.ts` hardcodes a production origin instead of using the same source as the root layout.
- Homepage is a client component, so it relies on root defaults instead of a dedicated page-level metadata boundary.
- Some public pages have no dedicated metadata layout.
- Large commented legacy blocks make public pages unnecessarily large and hard to maintain.
- Marketing copy contains claims that should be backed by real platform data before being treated as facts.
- Contact UI currently simulates sending instead of calling the real contact API.

SEO principle:
Build fewer, stronger pages with unique useful content. Do not create large numbers of thin city/service doorway pages just to fill the sitemap.

## 6. World-class target architecture

### Order domain
One canonical transition service owns every supplier order mutation.

### Dispatch
A deterministic dispatch engine:
1. serviceable order
2. eligibility filters
3. scoring/ranking
4. offer
5. timeout/reject
6. retry
7. exhaustion exception

### Inventory
Atomic DB functions:
- reserve
- release
- consume

### Finance
Every completed order stores a financial snapshot:
- customer gross
- taxable base
- GST
- platform fee
- supplier payout
- payout state

### Operations
Scheduled recovery job + realtime UI.
Customer pages must never be responsible for operational recovery.

### SEO
- valid indexable URLs only
- dedicated metadata
- structured data where page content supports it
- canonical/robots discipline
- clean internal linking
- fast mobile-first public pages
- unique service/local content
- no fake ratings, prices, counts or guarantees

## 7. Rollout order

### Phase 1 — Foundation
- Supplier online/offline
- Canonical supplier state transitions
- Dispatch sweeper cron
- Contact form real API
- Clean SEO primitives
- Fix sitemap
- Production audit document

### Phase 2 — Marketplace reliability
- Atomic inventory reservation
- Earnings calculation
- Persistent payouts
- Subscription retry/exception handling
- Admin stuck-order queue

### Phase 3 — Supplier operating system
- Fleet backend
- Vehicle capacity
- Supplier business profile
- Documents
- UPI/bank verification
- Working hours

### Phase 4 — Customer growth
- Service detail pages
- Kanpur hub
- subscription UX
- business/bulk landing pages
- referral/loyalty
- reviews/trust surfaces backed by real data

### Phase 5 — Scale
- queue/event architecture
- Redis where needed
- delivery tracking
- route optimization
- observability/Sentry
- advanced fraud/risk controls

## 8. Acceptance criteria

A release is production-ready only when:
- a supplier can intentionally go online/offline from the dashboard and dispatch respects it;
- accept/reject/timeout transitions are server-authoritative;
- no accepted order can be silently reassigned;
- timeout/retry runs without customer interaction;
- inventory cannot go negative through concurrency;
- supplier earnings are traceable from completed orders;
- payout requests are persisted and auditable;
- pricing/GST are consistent between preview, checkout, recurring orders and finance;
- subscription failures stay recoverable;
- every indexed sitemap URL resolves to a useful public page;
- contact forms persist submissions;
- public metadata/canonical/structured data match actual page content.

## 9. SEO implementation guidance

Google recommends Organization structured data on the home/about page and encourages relevant organization properties rather than copying organization markup onto every page. Use LocalBusiness only where the page represents a real local business location and the supplied facts are accurate.

Next.js supports page/layout metadata, metadata files for robots/sitemaps, and dynamic metadata functions. Keep these close to the route that owns the content.

Do not treat structured data as a ranking shortcut. The content and UX must be useful to people first.

