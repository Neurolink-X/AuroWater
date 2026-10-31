# AuroTap: safe editorial automation and incident response

## Manual articles
Edit `src/lib/blog/posts.ts` (manually written guides) or add an **approved, attributed** update to `src/data/water-news-reviewed.json`. Changes go through normal GitHub PR review, CI and deployment. An editor checks safety, originality, copyright, factual accuracy, sources, date and any marketing claims before merge. `publish_at` schedules first visibility at the next hourly cache revalidation; no page appears before its date.

## Automated discovery (not publication)
The free GitHub Actions workflow `water-news-discovery.yml` checks a bounded Google News RSS search every six hours. It stores title, date, source lead and status in `content/water-news-candidates.json`, and opens/updates **one editorial review PR**. Leads are untrusted. RSS is not proof of a claim, and syndication is not a license to copy text. Never paste the original article, scrape protected sites, invent citations, or imply AuroTap broke the news first.

A human must independently verify the primary source and write an original, short update with an attributed `source_url`. For every entry in `src/data/water-news-reviewed.json`, provide `slug`, `title`, `summary`, `source_name`, `source_url`, `source_published_at`, `reviewed_at`, `publish_at` (ISO timestamps). Verify Google Search indexing policies and correct business/serviceability claims. The news route and sitemap expose only validated reviewed entries after their publish time.

**GitHub Actions requirements:** repository workflows must be enabled; repository settings must permit GitHub Actions to open PRs. If PR creation is blocked, the scheduled job logs the GitHub permission error rather than publishing. All publication requires a reviewed merge. No paid APIs.

## Self-healing incident watchdog
`site-health-watchdog.yml` runs every 30 minutes and on manual dispatch. It checks `/api/health`, `/`, `/blog`, and `/api/settings` with 7-second timeouts, three retries and bounded concurrency. It creates or comments on one GitHub incident issue, and closes the incident when all probes recover. It cannot run arbitrary AI-generated patches, reset credentials, overwrite pricing, issue refunds, or deploy code. This is deliberate: autonomous production code modification is not safe.

When developers are unavailable, the runbook is: confirm the failing endpoint and Vercel status, inspect recent deployment and Supabase health, avoid payment/order mutations, use last known-good deployment via an authorized operator if deployment-specific, and leave a clear incident trail. Payments, security changes and schema migrations always require review.

## SQL and algorithm audits
`SUPABASE_DB_URL=... node scripts/audit-index-overlap.mjs` reads index metadata and index-use counters, grouping *potentially* identical index signatures in O(n) expected time and bounded memory. It does not drop indexes. Measure slow queries with `EXPLAIN (ANALYZE, BUFFERS)` on a staging database before any removal; index scan counts may be reset on database restart. Query-specific optimization beats blindly adding/dropping indexes.

## Guardrails
- News: source first, review before publication, no fake awards/testimonials, no unattended AI writing.
- Operations: health-check probes only, no secrets, no user/order payloads sent to public incident issues.
- Performance: monitor web vitals and slow endpoints; measure actual P95 before and after optimizing.
- No changes to production payments, payouts, prices, suppliers or permissions from these automations.
