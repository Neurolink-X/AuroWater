import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (path) => readFileSync(path, 'utf8');
const sql = src('supabase/migrations/20261103062000_dispatch_retry_control.sql');
const dispatch = src('src/lib/dispatch.ts');
const sweep = src('src/app/api/internal/technician-dispatch-sweep/route.ts');
const settings = src('src/hooks/useSettings.ts');

test('retry table contains operational data only and is private', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.dispatch_retry_state/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.dispatch_retry_state FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_dispatch_retry\(uuid\) TO service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.record_dispatch_failure\(uuid,text\) TO service_role/);
  assert.match(sql, /ON CONFLICT\(order_id\) DO UPDATE/);
  assert.match(sql, /s\.next_retry_at <= clock_timestamp\(\)/);
  assert.match(sql, /LEAST\(3600,120\*power/);
  assert.match(sql, /status='PENDING'/);
  assert.match(sql, /LIMIT 250/);
  const writes = [...sql.matchAll(/DELETE FROM\s+([\w.]+)/gi)].map(match => match[1]);
  assert.deepEqual(writes, ['public.dispatch_retry_state']);
  assert.doesNotMatch(sql, /DELETE FROM public\.orders|TRUNCATE TABLE|VACUUM FULL/i);
});

test('scheduled recovery claims an atomic lease before each dispatch', () => {
  assert.match(dispatch, /export async function claimDispatchRetry/);
  assert.match(dispatch, /rpc\('claim_dispatch_retry'/);
  assert.match(dispatch, /rpc\('record_dispatch_failure'/);
  assert.match(dispatch, /await claimDispatchRetry\(db, String\(o\.id\)\)/g);
  assert.match(sweep, /await claimDispatchRetry\(db, String\(order\.id\)\)/g);
  assert.match(sweep, /dispatchTechnicianJob\(String\(order\.id\)\)/);
  assert.match(sweep, /dispatchOrder\(String\(order\.id\)\)/);
  assert.doesNotMatch(sql, /SET dispatch_attempts/);
});

test('settings requests are coalesced per city and never persist unverified pricing', () => {
  assert.match(settings, /settingsInFlight = new Map/);
  assert.match(settings, /city\?\.trim\(\)\.toLowerCase\(\)/);
  assert.match(settings, /settingsInFlight\.set\(normalized, promise\)/);
  assert.match(settings, /settingsInFlight\.delete\(normalized\)/);
  assert.match(settings, /cache: 'no-store'/);
  assert.match(settings, /signal\.removeEventListener\('abort', onAbort\)/);
  assert.match(settings, /Number\.isInteger\(s\.pricing_version\)/);
  assert.doesNotMatch(settings, /localStorage\.setItem\('payment/);
});
