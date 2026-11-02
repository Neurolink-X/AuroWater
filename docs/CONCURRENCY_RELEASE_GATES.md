# AuroTap high-concurrency release gates

**Capacity is not certified by a green build.** One million concurrent bookings requires measured admission control, database capacity, queue throughput and provider dispatch correctness.

## Verified foundation (2026-11-02)
- Production database has `orders.checkout_request_id` and the per-customer unique index `orders_customer_checkout_request_unique_idx` (read-only schema check).
- Booking client sends a stable UUID for retries of the same checkout fingerprint.
- API handles unique-key conflicts by fetching the authenticated customer's existing order.
- Dispatch uses atomic supplier stock reservation, with a scheduled retry sweep.
- The optional idempotency feature flag has been removed from the API; the existing unique index is now authoritative for UUID-bearing checkout requests.

## Release gates before claiming any capacity
1. **Correctness:** On an isolated staging database, launch 1,000 concurrent requests with the *same* customer and checkout UUID. Expect exactly one order, one stock reservation, no duplicate reward redemption and consistent responses. Repeat with distinct UUIDs, distinct customers and different prices.
2. **Load:** Ramp from 10 → 100 → 1,000 → 10,000 virtual users. Record sustained requests/sec, p50/p95/p99 latency, 429/5xx rate, database connections, lock waits and queue lag. Never aim 1M synthetic users at production.
3. **Recovery:** Force worker termination after order commit, supplier accept race, API timeout and duplicate retry. Verify eventual assignment, single financial posting and no stuck orders.
4. **Backpressure:** Before increasing traffic, implement shared distributed rate limits/admission control, a durable queue, bounded worker concurrency and dead-letter reprocessing. A serverless instance's in-memory counter is not distributed protection.
5. **Security:** Verify RLS ownership and role checks, secrets isolation, webhook authentication and payment reconciliation under retries.
6. **Observability:** Instrument order creation → dispatch → supplier acceptance → completion with trace IDs, alert on aged PENDING orders and dispatch retry lag, and test alert delivery.
7. **Rollout:** Deploy behind measured feature flags, canary gradually, watch error budgets and roll back on regression.

## Acceptance criteria
- Zero duplicate committed orders for the same authenticated customer and checkout UUID in the test environment.
- Zero negative supplier stock or duplicate assignment during concurrent acceptance/retry.
- No order lost after process termination; queued work is retried or sent to a visible dead-letter queue.
- Demonstrated p95 and p99 latencies at the **tested** throughput and workload mix.
- Capacity claim must name the measured concurrency, sustained RPS, region, database tier, duration and observed error rate.

## Important limitations
- The existing 20-second duplicate-query fallback for legacy requests without a UUID is **not atomic**. Migrate all clients to mandatory request UUIDs before strict guarantees.
- `after()` work is best-effort, not a durable distributed queue. A periodic sweep helps recover but is not sufficient for 1M concurrent requests.
- This document is a release checklist, not a claim that load tests or queue migration have already been completed.
