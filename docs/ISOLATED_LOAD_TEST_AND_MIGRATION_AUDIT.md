# Migration and concurrency verification (2026-11-02)

## Read-only production audit
- Supabase migration registry currently returns 15 entries (2026-10-31 through 2026-11-01). This **does not prove** that older SQL migrations were reconciled; the repository has legacy, numbered and timestamped migration sources.
- Supabase development branches: **none**. No isolated Supabase database currently exists for a destructive concurrency test.
- The production checkout request UUID column and unique index were previously confirmed present.
- Do not infer a complete schema history from the 15 registry entries alone. Compare checksums and schema fingerprints of all repository migrations against a clean database restore, then reconcile unapplied historical migrations in a reviewed migration PR.

## Safe temporary-user test plan
1. Create a **separate staging project** with a separate DB and payment sandbox. Supabase branch creation may incur charges and needs approval; do not use the production project.
2. Seed synthetic accounts using a `loadtest_` namespace and isolated fixture IDs. Use test email domains; never deliver real SMS/email or initiate real UPI transactions.
3. Assert that concurrent retries sharing the same checkout UUID produce exactly one order and one financial ledger posting.
4. Concurrently accept one order from multiple eligible suppliers; verify only one wins and stock never goes below zero.
5. Kill a worker after commit and verify a durable job recovers without duplicate payouts.
6. Ramp realistic traffic and collect p50/p95/p99 latency, requests/sec, DB connections, deadlocks, queue lag, error rate and recovery duration.
7. Drop the staging project or delete the isolated test schema after capturing anonymized aggregate metrics.

## Zero-write synthetic model
Run `node scripts/test-synthetic-concurrency.mjs` to exercise a bounded in-memory admission/deduplication model. Set `SYNTHETIC_USERS=1000000` to simulate one million **intents**, not one million real connections. It makes no database/network requests and is **not** evidence that production handles one million simultaneous users.

## Architecture gates before scale claims
- Durable dispatch queue with atomic claim, lease expiry, retry schedule, dead-letter queue and idempotent consumer.
- Distributed admission control with backpressure and explicit 429 + Retry-After.
- Transactional outbox for booking-to-dispatch events to avoid losing work after order commit.
- Database-level unique constraints, RLS and finite connection pool budgets.
- Realistic isolated load tests on the intended Vercel/Supabase tiers and regions.
- Alerting for old pending orders, stock mismatch, p99 latency, failed webhooks and retry backlog.

**No 1M concurrency certification is claimed.** CI and synthetic simulations are necessary but not sufficient for a production capacity guarantee.
