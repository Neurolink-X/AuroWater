# Weekly water-news publication

This is a source-attributed headline brief, not an AI-written report or an independent fact check. It uses short headlines and links to publishers; RSS article bodies and descriptions are not republished.

## Flow

- Production Vercel cron calls `/api/cron/blog-publish` daily at `03:13 UTC` (approximately `08:43 IST`, subject to platform scheduling accuracy).
- The Sunday IST date identifies a publishing week. The first eligible run creates one brief for that week; later daily checks only repair cache/status or return `already_published`.
- Daily checks provide recovery after feed/DB/network failures or a missed Sunday invocation. A first deployment during the week can catch up that week. There is no burst of backdated posts.
- A brief has at most three recent, relevant, deduplicated headlines. This is a per-brief limit, not a lifetime cap. Weeks are date-derived, not selected from a finite topic list.
- News is stored in the existing `blog_posts` table, not in repository JSON, so each article does not need a commit, PR or redeployment. Manual guides and reviewed news retain their existing flows.
- The unique `blog_posts.slug` constraint plus conflict-ignore insert provides idempotency across concurrent invocations. A draft with the weekly slug is never overwritten.
- Successful runs invalidate the managed-guide cache and blog/article/sitemap pages. Old article URLs use a direct published-only lookup when outside the 100-post listing.

## Existing prerequisites

- `CRON_SECRET` must be present for production. Vercel sends it as a Bearer header; missing/wrong credentials are rejected before feed or database work.
- Existing Supabase service credentials and `blog_posts` are required. No migration, browser database grant or RLS change is needed.
- Publishing only runs with `VERCEL_ENV=production`. Set `AUTO_BLOG_PUBLISH_ENABLED=false` to stop future automated publishing; existing posts remain available.
- Merge and deploy the cron configuration to register the job. Confirm the project-level Cron Jobs switch in Vercel is enabled. Preview deployments intentionally cannot publish.

## News input and failure behavior

- Feeds are fixed in code. Google News metadata is filtered to selected publishers; direct publisher feeds provide fallback. No URL from user content is fetched.
- HTTPS publisher/source links, valid dates no older than seven days, relevance and length are checked. Headlines are capped at twenty words and 160 characters. Full RSS bodies are ignored.
- Feed fetches reject redirects and non-XML responses, allow two attempts, have an eight-second timeout each and a 450,000-byte streamed body cap per feed. Five feeds run concurrently; no customer page performs this fetching.
- The frontend labels the brief as automated and includes original source links and source dates.
- No eligible sources or an upstream error returns HTTP 503, records a private draft status and logs `[blog/weekly]`; the next daily check tries again. The system never fabricates a news item to fill a date.
- The operational draft `automation-water-news-status` is excluded from the admin article list and public readers. It records only the latest attempt/result; it is not an audit-history or notification service.

## Operator visibility and verification

Open **Admin → Blog publishing → Weekly news** for configuration state, next daily check, latest weekly article and last result/failure. Refresh status after a cron run.

Offline checks: `node --test tests/admin-blog-auth-weekly-publishing.unit.mjs tests/platform-domain-ownership.unit.mjs`.

After the first production run, verify the weekly post in Admin, `/blog`, the article source links and `/sitemap.xml`. Check Vercel cron/runtime logs if no status was recorded. A missing invocation cannot record its own failure; the daily schedule reduces this risk but does not guarantee delivery. Unit tests and a preview build do not prove a production cron invocation or external-feed availability.

No production posts or operational rows are seeded by this PR. Publication begins when the deployed production scheduler runs successfully.
