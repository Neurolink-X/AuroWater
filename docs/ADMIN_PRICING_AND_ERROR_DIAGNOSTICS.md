# Admin pricing and private error diagnostics

## Pricing

Admin settings GET now overlays legacy preferences with the same currently effective immutable pricing version used by public settings, including optional city overrides and service fees. Both reads run concurrently. The ETag includes the published values; a scheduled version cannot be selected early. A pricing failure returns an error instead of presenting old legacy amounts as current prices. Admin settings refreshes on focus and same-browser pricing publication without replacing unsaved edits.

Order details remain checkout receipts, not new quotes. A subscription receipt can legitimately have a different rate from a new one-time quote. The booked plan and snapshot determine the accepted amount. The UI now identifies the plan, quantity, unit price, saved option, discounts and combined handling/delivery fee. Missing historical fields are labelled rather than inventing a current rate. No order, ledger or payment is repriced or rewritten.

## Error coverage and limits

Admin menu → More tools → Platform Errors (`/admin/errors`). Read access requires a verified admin in the API; the browser database roles have no table/RPC access. The page displays 40 entries per page with group filters, time, count, HTTP status, safe route template, category and actionable guidance. Refreshes every 30 seconds only while visible; no polling elsewhere. Pending reads abort on leaving the page.

The existing root error reporter additionally observes same-origin API 5xx and non-cancelled network failures while preserving original requests, bodies, credentials, responses and thrown errors. It sends at most three diagnostic events per minute per tab, deduplicates repeated signatures, and excludes telemetry requests to prevent feedback loops. Global runtime errors and promise rejections are captured; Next instrumentation captures unhandled server errors. Expected 4xx validation/auth failures, manually caught errors without a failing API, resource/image failures and external-provider errors that never surface in a covered boundary are not automatically incidents. When scripts, network or storage are unavailable, a report may be absent. Browser reports are untrusted diagnostic signals, never proof of an incident or an instruction to modify data.

Only allowlisted codes, safe static route vocabulary, route group, source and server status are persisted. IDs/unknown path segments are masked, queries are dropped, and exception messages, stacks, credentials, request bodies and contact information are discarded. Original deployment logs remain the source for exact causes. Report intake requires same-origin headers plus the existing durable HMAC rate limiter (15 events/network/minute), failing closed if unavailable. Telemetry never triggers order/payment retries.

## Storage and release

Apply `supabase/migrations/20261122114515_platform_error_diagnostics.sql` before deploying the feature. It creates only `platform_errors` and its service-only invoker RPC; existing data is untouched. Atomic conflict-upsert aggregates minute buckets. Indexed cleanup removes up to 100 expired entries and up to 100 excess entries per ingest, keeping the newest 5,000 after backlog drains. Reads always hide entries older than 30 days. If no new errors arrive physical cleanup waits until the next ingest. No immutable audit/financial table is used for disposable diagnostics.

Without the migration the admin page gives a storage/setup error and existing application operations keep working. No production migration or deployment is performed by the code change itself. Verify the production menu, admin-only API and a safe synthetic staging error after release. A successful build does not prove a real production incident was captured.

## Admin redundancy and reload follow-up

The legacy `/admin/dashboard/users` implementation is replaced by a server redirect to the canonical Users page, retaining the pending approvals/application queue and query filters. Remove the redundant Approvals menu entry; old links remain valid. The maintained Users page already provides partner applications, verification links, account recovery, bulk approval and role controls. No operational page or backend permission is removed.

Order details no longer preload a technician list simply because a drawer opens; eligible specialists are requested when the assignment picker is opened. Water orders retain the supplier-dispatch workflow. User filters cancel obsolete requests; coverage polling skips overlapping background work and aborts on navigation. Existing admin session rechecks and live update intervals remain in place.

Both shared API readers now combine identical pending GETs even when callers have their own cancellation signals. One cancelled component cannot cancel another active consumer; the underlying read aborts only when no consumers remain. Keys include the full headers (including authentication), path/filters and fetch policy. Completed/failed requests are immediately removed. Session-token reads also share an in-flight operation without caching tokens. Writes bypass sharing and detach older read generations before/after mutation, so a post-write refresh cannot join a pre-write read. No new response cache, persisted admin data, background polling or dependency is added by this follow-up. Native fetch/retry/write behavior is retained.

This reduces avoidable work; it does not guarantee instant reloads on every network/device. Custom APIs and server/database execution still determine latency. Do not treat removing duplicate requests as a measured real-device speed percentage.
