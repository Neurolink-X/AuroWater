#!/usr/bin/env node
/**
 * Safe, zero-write synthetic admission-control test.
 * No network, Supabase credentials, real accounts or payment calls.
 * Models up to 1,000,000 concurrent client intents using bounded batches.
 * This does NOT certify live database or infrastructure capacity.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const total = Number(process.env.SYNTHETIC_USERS ?? 100_000);
const concurrency = Number(process.env.SYNTHETIC_CONCURRENCY ?? 500);
const capacity = Number(process.env.SYNTHETIC_CAPACITY ?? 1000);
if (![total, concurrency, capacity].every(n => Number.isSafeInteger(n) && n > 0)) {
  throw new Error('All test parameters must be positive safe integers');
}
if (total > 1_000_000 || concurrency > 10_000 || capacity > 10_000) {
  throw new Error('Safety limit exceeded; test is bounded to 1M intents, 10k active workers');
}
const seen = new Set();
let active = 0, maxActive = 0, accepted = 0, throttled = 0, duplicates = 0;
const start = performance.now();
async function simulate(id) {
  if (active >= capacity) { throttled++; return; }
  active++;
  maxActive = Math.max(maxActive, active);
  try {
    // Model stable request IDs: each second intent is a retry of the same checkout.
    const key = Math.floor(id / 2);
    if (seen.has(key)) duplicates++;
    else { seen.add(key); accepted++; }
    await Promise.resolve();
  } finally { active--; }
}
for (let offset = 0; offset < total; offset += concurrency) {
  const batch = Array.from({ length: Math.min(concurrency, total - offset) }, (_, i) => simulate(offset + i));
  await Promise.all(batch);
}
assert.equal(active, 0);
assert.ok(maxActive <= capacity);
assert.equal(accepted + duplicates + throttled, total);
assert.equal(seen.size, accepted);
console.log(JSON.stringify({ kind: 'in-memory-model-only', totalIntents: total, uniqueAccepted: accepted, duplicateRetries: duplicates, throttled, peakActive: maxActive, elapsedMs: Math.round(performance.now() - start), noDatabaseWrites: true }, null, 2));
