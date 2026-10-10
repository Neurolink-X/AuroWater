# AuroWater Production Readiness Audit
**Audit date:** 2026-10-10  
**Audited ref:** main at `a243ef4a580c56cb1276a258ebe5e6ceb99c8fff`  
**Scope:** repository-level review of configuration, CI, supplier API/dashboard, public SEO metadata, city/service landing pages, and tracked environment files.

## Executive summary
The latest GitHub Actions CI run on the audited main commit is green (lint, regression tests, production build). That is useful evidence, but it is not proof of a zero-console-error browser session, live Supabase schema compatibility, realtime delivery, or production readiness across all roles. Those require deployed-environment checks.

## Findings by severity

### P0 — Credentials / repository hygiene
- `.env.local` is tracked in the public repository even though `.gitignore` excludes environment files. It contains configuration keys for Supabase and Google Maps; values are intentionally not reproduced here.
- Removing the file from the current branch does **not** remove it from Git history and does not revoke credentials. Rotate/revoke any server-side secrets that were present (especially the Supabase service-role key and Google Maps key if exposed), review provider logs, and keep production values only in Vercel/Supabase secret settings.
- The public Supabase anon/publishable key is designed for browser use, but it still requires correct RLS policies.

### P1 — SEO / marketing accuracy
- Generated Open Graph art currently advertises Delhi, while the declared active service cities are Gorakhpur, Kanpur, and Lucknow. Social share text should match real service coverage.
- SEO foundations already exist: canonical metadata helpers, robots rules, a sitemap, city-specific water-delivery pages, service detail pages, and JSON-LD on city pages.
- The sitemap is a manually maintained route list. Verify every listed URL returns 200 and is indexable; do not index private/customer/supplier/admin routes or thin/duplicate location pages.
- City pages currently use a third-party Wikimedia image. This is not a reliable substitute for owned, brand-consistent campaign imagery. Add original, optimized assets under `public/marketing/` and integrate only after confirming licensing, dimensions, alt text, and visual quality.
- Review service-page starting-price copy against the server/database pricing engine before launch; marketing prices must not conflict with live checkout totals.

### P1 — Supplier order workflow
- Supplier order API exists at `src/app/api/supplier/orders/route.ts`, enforces supplier role, scopes orders to the authenticated supplier ID, and enriches customer contact/service labels server-side.
- Supplier dashboard exists at `src/app/supplier/dashboard/page.tsx`; inventory/settings/earnings/payout APIs and atomic dispatch SQL migrations are present.
- Repository inspection alone cannot prove real-time delivery, reschedule/reject state transitions, push/browser notifications, concurrency behavior, or deployed schema alignment. Verify each state transition against a real test supplier and customer, with two suppliers competing for the same order.
- Keep service-role reads server-side and return only the minimum customer contact details needed by the assigned supplier.

### P2 — Reliability / testing
- CI runs lint, regression tests, and a production build with placeholder environment variables. Latest observed run passed.
- Add or run deployed smoke tests for customer booking, supplier accept/reject/reschedule, stock reservation/release, technician dispatch, admin access boundaries, auth redirects, and refresh/deep-link routing.
- “Zero console errors” cannot be certified from static source or a build alone. Capture browser console + failed network requests on desktop and mobile after deployment.
- Confirm production observability/alerting, rate limits on OTP/auth/booking endpoints, backup/restore readiness, and incident/rollback procedures.

## Ordered execution plan
1. **Contain credential exposure:** remove tracked `.env.local` from the working branch; rotate exposed secrets separately and review Git history/provider logs.
2. **Correct SEO truthfulness:** align Open Graph imagery and copy with active cities; validate sitemap URLs, canonicals, metadata, and structured data.
3. **Own the marketing imagery:** add original project/service illustrations in optimized local assets; use descriptive filenames, dimensions, alt text, and Next/Image where suitable.
4. **Verify supplier lifecycle:** test notification delivery and order transitions end-to-end with production-like records; ensure database functions/RLS enforce state and ownership.
5. **Run release gates:** CI green, deployed role-based smoke tests green, no uncaught browser console errors, no failed critical requests, mobile checks complete, and rollback path confirmed.

## Verification status
- [x] Repository and core config inspected.
- [x] Latest observed main-branch CI run passed.
- [x] Tracked environment file exposure identified.
- [ ] Secret rotation and provider-log review (requires owner action).
- [ ] Live browser console/network verification.
- [ ] Live Supabase/RLS/realtime/concurrency verification.
- [ ] Original marketing assets integrated and visually reviewed.
- [ ] Full customer/supplier/technician/admin release checklist passed.

This audit is a snapshot of the reviewed commit, not a claim that every production gate has passed.
