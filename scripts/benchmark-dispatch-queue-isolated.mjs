#!/usr/bin/env node
/**
 * Explicitly opt-in synthetic queue benchmark for DISPOSABLE Postgres only.
 * No customer orders, payments, suppliers, or user accounts are touched.
 * Results measure just insert/claim/ack mechanics, NOT real booking capacity.
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const permitted = process.env.AUROTAP_ALLOW_QUEUE_BENCH === 'DISPOSABLE_DB_QUEUE_BENCHMARK_ONLY';
const connectionString = process.env.AUROTAP_TEST_DATABASE_URL;
const count = Number(process.env.AUROTAP_BENCH_ITEMS ?? 1000);
if (!permitted || !connectionString || !Number.isSafeInteger(count) ||
    count < 100 || count > 100000) {
  console.error('Refusing queue benchmark: explicit opt-in, disposable test database and 100-100000 items required.');
  process.exit(2);
}
let url;
try { url = new URL(connectionString); }
catch { console.error('Invalid PostgreSQL URL'); process.exit(2); }
if (!/^(postgres:|postgresql:)$/.test(url.protocol) ||
    !/test|staging|branch/i.test(decodeURIComponent(url.pathname.slice(1))) ||
    url.hostname.includes('mwfcwhxdlnqldciigicl') ||
    url.hostname.includes('aurotap.in')) {
  console.error('Refusing to benchmark a production-like database.');
  process.exit(2);
}

const pool = new pg.Pool({
  connectionString, max: 7,
  connectionTimeoutMillis: 8000, statement_timeout: 20000,
  application_name: 'aurotap-disposable-queue-benchmark',
});
const timings = [];
function metric(value) { if (timings.length < 4096) timings.push(value); }
function quantile(p) {
  if (!timings.length) return 0;
  const sorted = [...timings].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] * 100) / 100;
}
const claimSQL = [
  'WITH claimed AS (SELECT id FROM aurotap_queue_bench.items',
  "WHERE state = 'ready' ORDER BY created_at, id",
  'FOR UPDATE SKIP LOCKED LIMIT 4)',
  'UPDATE aurotap_queue_bench.items q',
  "SET state = 'leased', attempts = attempts + 1, lease_until = now() + interval '90 seconds'",
  'FROM claimed c WHERE c.id=q.id RETURNING q.id',
].join(' ');

let created = false;
try {
  const identity = await pool.query('SELECT current_database() AS name');
  if (!/test|staging|branch/i.test(String(identity.rows[0]?.name ?? ''))) {
    throw new Error('Refusing production-like database identity.');
  }
  await pool.query('CREATE SCHEMA aurotap_queue_bench');
  created = true;
  await pool.query("CREATE TABLE aurotap_queue_bench.items (id uuid PRIMARY KEY, state text NOT NULL DEFAULT 'ready', attempts int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz)");
  await pool.query("CREATE INDEX queue_ready_bench_idx ON aurotap_queue_bench.items(created_at,id) WHERE state='ready'");

  const startInsert = performance.now();
  for (let i = 0; i < count; i += 2000) {
    const uuids = Array.from({ length: Math.min(2000, count - i) }, () => randomUUID());
    await pool.query('INSERT INTO aurotap_queue_bench.items(id) SELECT unnest($1::uuid[])', [uuids]);
  }
  const insertMs = Math.round(performance.now() - startInsert);
  let completed = 0;
  let inFlight = 0;
  let maxConcurrent = 0;
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (;;) {
      const start = performance.now();
      const claimed = await pool.query(claimSQL);
      metric(performance.now() - start);
      const ids = claimed.rows.map(row => row.id);
      if (!ids.length) break;
      inFlight += ids.length;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      const ack = await pool.query(
        "UPDATE aurotap_queue_bench.items SET state='done',lease_until=NULL WHERE id=ANY($1::uuid[]) AND state='leased'",
        [ids],
      );
      if (ack.rowCount !== ids.length) throw new Error('Duplicate/missing ack in disposable benchmark');
      completed += ack.rowCount;
      inFlight -= ids.length;
    }
  }));
  const seconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const remaining = await pool.query("SELECT count(*)::integer n FROM aurotap_queue_bench.items WHERE state<>'done'");
  if (completed !== count || remaining.rows[0].n !== 0 || maxConcurrent > 24) {
    throw new Error('Synthetic queue invariant failure.');
  }
  console.log(JSON.stringify({
    test: 'synthetic-queue-only', database: 'disposable',
    items: count, insert_ms: insertMs,
    queue_ops_per_second: Math.round(completed / seconds * 100) / 100,
    claim_p50_ms: quantile(0.5), claim_p95_ms: quantile(0.95),
    claim_p99_ms: quantile(0.99), max_in_flight: maxConcurrent,
    warning: 'NOT a production booking or 100k concurrent users capacity test.',
  }, null, 2));
} catch (error) {
  console.error('Isolated queue benchmark failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
} finally {
  if (created) {
    try { await pool.query('DROP SCHEMA aurotap_queue_bench CASCADE'); }
    catch { console.error('Cleanup unavailable: inspect disposable test database.'); }
  }
  await pool.end();
}
