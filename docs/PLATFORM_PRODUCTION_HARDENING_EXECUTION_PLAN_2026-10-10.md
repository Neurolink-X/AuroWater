# AuroTap Platform Production Hardening — Execution Plan
Date: 2026-10-10
Base: main (isolated feature branch)

## Operating rules
- Preserve existing route contracts and working behavior; make small, reviewable changes.
- Do not introduce duplicate tables or invent columns/RPCs. Confirm migrations and production schema before database changes.
- Never claim production readiness, zero console errors, live realtime, or payment completion without tests/evidence.
- Treat server-side order pricing as authoritative. Client totals are display-only and must be reconciled against the server.
- Do not invent reviews, certifications, delivery guarantees, customer counts, discounts, or service availability.
- Keep secrets out of source control; rotate any credential previously committed.

## P0 — Pricing, fees and order integrity
- Reconcile pricing cards, service details, booking wizard, subscription calculator, order API, persisted order fields, supplier payout calculation, commission, and admin settings.
- Current customer order API inspected on main: water-can price is server-calculated (Normal RO ₹20, Chilled RO ₹25, subscription rate capped by code); GST rate is hard-coded to 0; convenience fee is zero for water-can; emergency fee comes from settings with a ₹199 fallback; other services use settings/database rates and option deltas.
- Business owner must confirm tax registration and the intended displayed fee policy before changing GST or introducing fees.
- Add/extend tests for quantity boundaries, subscription frequency, chilled-subscription rejection, stale client totals, option validation, emergency charges, rounding, and API error paths.
- Ensure UI itemizes unit price, quantity, service/options, fees, taxes (only when configured and legally applicable), discounts, and final total; never display savings that aren't real.

## P1 — Supplier order lifecycle
- Verify order dispatch, eligibility, online state, location/radius, inventory reservations, concurrency, accept/reject/reassignment, status transitions, customer notifications, and pending-order recovery.
- Verify every supplier UI action maps to a real, guarded API endpoint. No fake success states.
- Verify earnings source and payout status against canonical persisted data; payout request is not a bank transfer.
- Realtime subscription is not proven by polling fallback; test Realtime and fallback independently.

## P1 — Technician workflow
- Verify job queue eligibility and role checks, assignment, accept/start/completion, OTP/payment guards where required, schedules/time zone, documents/private storage, and customer notifications.
- Separate technician service dispatch from water-can supplier dispatch.
- Ratings and earnings must use real persisted data. Never fabricate values.

## P1 — Customer workflow
- Test signup/login/Google OAuth and role redirects, address ownership and geocoding, serviceability, price review, scheduling, duplicate-submit/idempotency behavior, cancellation/refund rules, tracking, reviews, and notifications.
- Confirm address edits/archives do not expose other customers' data.

## P1 — Admin, security and database
- Test admin invite-only registration and server-side authorization for every admin endpoint.
- Verify RLS, service-role key boundaries, supplier/technician ownership checks, audit logs, rate limits, webhook/cron authorization, upload validation, and PII minimization.
- Compare code queries with deployed schema and RPCs. Any migration must be additive, reviewed, ordered, and backed up; never run destructive SQL blindly.

## P2 — Public pages, SEO and marketing
- Audit public routes, title/description, canonical, robots, sitemap, structured data, internal links, image alt text, mobile layout, accessibility, and 404/redirect behavior.
- Create useful unique service/city content, FAQs based on actual capabilities, transparent pricing language, and conversion CTAs.
- Use properly licensed/generated marketing imagery and optimize image size/alt text. Integrate assets into actual pages, not just public folders.
- Do not publish unsupported quality certifications, testimonials, delivery promises, or location coverage.

## P2 — Quality gates and release
- Run lint, typecheck/build, regression, smoke tests and route/access tests on the feature branch.
- Add focused unit/integration tests for any corrected behavior.
- Test production deployment and representative flows for customer, supplier, technician and admin.
- Inspect browser console and network errors, server logs, Supabase errors, and mobile responsiveness.
- Merge only after review and green required checks; verify Vercel deployment commit matches merged main SHA.

## Acceptance checklist
- [ ] Pricing values match across UI/API/database/payout calculations.
- [ ] Order totals cannot be changed by client tampering.
- [ ] Each role's critical workflow has positive and negative tests.
- [ ] No dead buttons or success messages without persisted server success.
- [ ] Public SEO metadata and sitemap contain only valid canonical pages.
- [ ] Images are optimized, integrated and have meaningful alt text.
- [ ] Lint/typecheck/build/regression/smoke checks pass.
- [ ] Production deployment and role-based E2E tests pass.
- [ ] No unresolved critical security/data-integrity issue.
