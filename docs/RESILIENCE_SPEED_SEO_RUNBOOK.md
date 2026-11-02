# AuroTap: production resilience, speed and SEO runbook

## What this change actually does

- Customer, supplier, technician and admin reads using the shared transport retry **once**
  on transient HTTP 502/503/504 and temporary fetch errors. Backoff is shortened to
  200–300 ms so transient gateway issues clear sooner. Failed writes are **never** replayed.
- Identical concurrent admin GET reads are coalesced while in flight. Results are not
  cached beyond request completion, and token-scoped responses are never shared across users.
- All role groups report bounded, privacy-safe runtime errors to the existing telemetry
  endpoint. Only the error category and route group are sent, never exception text, stack,
  URL, account identifiers, tokens or order payloads.
- Preview/staging homepage metadata becomes noindex/nofollow, consistent with robots.txt.
  Sitemap lastmod is emitted only for published content with a real editorial timestamp.

## Recovery tiers

1. **Automatic, safe**: A single retry for read-only transient requests; in-flight GET
   deduplication; auth refresh already handled by the app; client telemetry is fire-and-forget.
2. **Detection/triage**: Production watchdog checks /api/health, homepage, blog,
   settings and city directory and opens an incident issue when repeat probes fail.
   Runtime category logs can be filtered in Vercel logs using `aurotap.runtime_error`.
3. **Human-approved actions**: Migration, price changes, payout reconciliation, stock
   reservation, dispatch mutation and production rollbacks are never performed by this
   client recovery layer. A patch must pass lint, tests, CodeQL and preview smoke tests.

## Verification checklist

- `npm run test:unit` and `npm run test:regression`; then `npm run lint`,
  `npm run build` and `npm run perf:bundle-report`.
- Confirm each role's real-device LCP, INP, CLS and API latency against
  `src/lib/observability/performance-budgets.ts` before claiming speed gains.
- Simulate a GET 502/503/504 and ensure exactly one retry; simulate POST timeout and
  ensure no retry or duplicate order/payment. Confirm pre-aborted reads issue no requests.
- Check preview homepage noindex, production metadata and robots, canonical links,
  sitemap public URLs and actual Google Search Console coverage.
- Verify the deployed SHA matches merged main. Check Vercel error logs and authenticated
  booking-to-payment, supplier dispatch and technician job lifecycle in preview first.

## Constraints

This is bounded resilience and diagnostics, **not** arbitrary AI self-modifying code.
No software can guarantee zero errors or instant recovery from a database outage.
Watchdog notifications require GitHub Actions to remain enabled; runtime logs require
Vercel logging access. No automatic code repair or deployment is initiated by runtime
error telemetry. Both CI and production must be verified before merging/releasing.
