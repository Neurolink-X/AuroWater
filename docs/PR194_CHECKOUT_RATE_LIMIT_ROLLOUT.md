# PR 194 — checkout concurrency and rate limiting rollout

## Confirmed risks
- A select-then-insert duplicate check within 20 seconds is a convenience guard, **not** an atomic lock. Concurrent requests can both pass it.
- API rate-limit RPC is durable and uses PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`, which atomically increments a rate counter. However, it previously failed open during missing credentials, network faults, or RPC errors.
- The Vercel **deployment rate limit** is an account/quota issue, unrelated to HTTP rate limiting. Avoid triggering extra preview deploys until quota is available.

## Deployment order (mandatory)
1. Confirm `RATE_LIMIT_SECRET` (or documented secure fallback secret) is present on Vercel, the existing `consume_account_recovery_rate_limit` RPC is deployed, and its service-role permissions work. Otherwise contact submissions and private uploads now return 503 by design.
2. Apply `supabase/migrations/202611010001_checkout_request_idempotency.sql` to the target database using your established reviewed migration workflow. Verify `public.orders.checkout_request_id` and the unique index `orders_customer_checkout_request_unique_idx`. Do not manually edit production data.
3. Deploy code with `CHECKOUT_IDEMPOTENCY_DB_ENABLED` unset or `false`. This preserves the old checkout path until the DB is ready. Database uniqueness is not active for checkout attempts until the flag is enabled.
4. Run **isolated staging DB tests**: two simultaneous POSTs with the same authenticated customer, same request UUID and identical payload should create exactly one order; replay should return its ID. A different UUID should not be blocked by the unique index. Verify supplier assignment and customer tracking; test reward and subscription retries too.
5. Turn on `CHECKOUT_IDEMPOTENCY_DB_ENABLED=true` only after the previous checks. New BookingWizard attempts send `checkout_request_id` automatically. Legacy checkout clients without UUID still rely on the old 20-second guard; monitor usage before enforcing required keys.
6. Watch 409/503 rates, unexpected order duplication, redemption reversals, P95 checkout duration, DB errors, and tracking status correctness. Roll back the feature flag (not the index) on unexpected checkout errors.

## Guarantees and limits
- Unique index prevents multiple rows with the **same customer + request UUID**. It does not deduplicate two deliberately different UUIDs or provide end-to-end transactionality for optional loyalty/referral/subscription side effects.
- SQL does not run automatically just because the PR is merged. Deploying code alone does not activate the index on the live database.
- Existing supplier completion remains guarded by conditional status changes and atomic `complete_supplier_order_atomic` RPC. No production payments or customer orders are mutated by this PR's unit tests.
- Redis/in-memory locks are not substitutes for the DB uniqueness boundary across Vercel serverless instances.

## CI release gate
- `npm run lint`
- `npm run test:unit`
- `npm run test:regression`
- `npm run build`
- CodeQL security scanning
- Staging end-to-end concurrent checkout, supplier acceptance, completion and customer tracking
