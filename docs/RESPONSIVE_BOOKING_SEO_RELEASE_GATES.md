# Responsive, booking, pricing and SEO release gates

This checklist is intentionally executable and evidence-driven. A line-count target is not a substitute for verified behavior.

## Mobile viewport matrix
Test widths 320, 360, 375, 390, 430, 768, 1024, 1280 and 1920 pixels, plus browser text zoom at 200%.
For each route, assert no document-level horizontal overflow and no clipped controls.
Use Playwright screenshots and compare against approved baselines; keep intentional horizontal scrolling limited to local tab strips.

## Routes by role
Public: home, services, service detail, pricing, booking, contact, city landing pages.
Customer: home, account, history, order tracking.
Supplier: dashboard, orders, settings, coverage.
Technician: dashboard, jobs, earnings.
Admin: dashboard, settings, pricing, orders, coverage requests, users, zones.
Run authenticated route tests with least-privileged test accounts. Never reuse production credentials.

## Booking acceptance criteria
Step 1 must display a recognizable service photograph with descriptive alternative text.
Images must preserve aspect ratio, use responsive sizes, and not delay first interaction.
Service selection must preserve existing draft restoration and keyboard focus behavior.
Show prices from the current settings source, and reconcile server-authoritative totals on review.
Test normal/chilled, subscriptions, bulk, emergency, and each non-water service.
Verify minimum normal 20 INR and chilled 25 INR against the server rules, not just the UI.
If admin changes a published rate, verify customer home, service cards, booking and API agree.

## Technical SEO checks
Public canonical URLs must use the configured production host and never point to preview deployments.
Brand name, organization structured data, open graph, page titles, app manifest and footer must agree.
Verify sitemap includes only indexable, published pages and valid city landing pages.
Robots must disallow private authenticated paths and staging deployments must be noindex.
Validate JSON-LD with a schema validator; never publish invented reviews or claims.
Check actual Google Search Console coverage, branded queries, canonical selection and Core Web Vitals.
Google ranking cannot be guaranteed through metadata changes.

## CI and production sign-off
Run npm ci, npm run lint, npm run test:unit, npm run test:regression, npm run build and npm run seo:audit-public.
Run automated browser viewport tests on preview, plus manual checks on Android Chrome and iOS Safari.
Measure LCP, INP and CLS using field telemetry, and compare before/after baselines.
Validate booking creation, order tracking, payment, and role permissions before merge.
Check deployment logs and error rates after release. Roll back on regressions.

## Current verification state
This document is a test plan, not proof that these checks passed.
