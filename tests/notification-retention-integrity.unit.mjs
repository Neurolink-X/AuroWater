import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(path, 'utf8');
const migration = src('supabase/migrations/20261103043000_bounded_disposable_retention.sql');
const notifier = src('src/lib/notifications.ts');
const dispatch = src('src/lib/dispatch.ts');
const stock = src('src/app/api/supplier/stock/route.ts');
const milestones = src('src/lib/milestone.ts');
const supplier = src('src/app/supplier/dashboard/page.tsx');

test('retention runs once daily in bounded batches without modifying critical data', () => {
  assert.match(migration, /private\.prune_disposable_history\(\)/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /'17 3 \* \* \*'/);
  assert.match(migration, /status = 'succeeded'/);
  assert.match(migration, /end_time < clock_timestamp\(\) - interval '7 days'/);
  assert.match(migration, /expires_at < clock_timestamp\(\) - interval '2 days'/);
  assert.match(migration, /updated_at < clock_timestamp\(\) - interval '30 days'/);
  assert.match(migration, /LIMIT 2000/);
  assert.match(migration, /LIMIT 500/);
  const deletedFrom = [...migration.matchAll(/DELETE FROM\s+([\w.]+)/gi)].map((item) => item[1]).sort();
  assert.deepEqual(deletedFrom, ['cron.job_run_details', 'public.account_recovery_rate_limits', 'public.otp_requests']);
  assert.doesNotMatch(migration, /VACUUM FULL|TRUNCATE\s|DROP\s+TABLE/i);
});

test('client roles cannot invoke private cleanup via public endpoints', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.prune_disposable_history\(\) FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /GRANT EXECUTE.*authenticated/);
});

test('notification writer uses actual production schema and recipient-specific dedup', () => {
  assert.match(notifier, /message: body/);
  assert.match(notifier, /data: \{ order_id: orderId \}/);
  assert.match(notifier, /order_\$\{orderId\}_\$\{eventType\}_\$\{userId\}/);
  assert.doesNotMatch(notifier, /order_id:\s*orderId,/);
  assert.match(dispatch, /data: \{ order_id: orderId \}/);
  assert.match(stock, /message: `Your available cans are low/);
  assert.match(milestones, /message: body/);
});

test('supplier notification UI reads canonical message and deduplicates realtime entries', () => {
  assert.match(supplier, /body: item\.message \?\? item\.body \?\? ''/);
  assert.match(supplier, /body: incoming\.message \?\? incoming\.body \?\? ''/);
  assert.match(supplier, /prev\.some\(\(item\) => item\.id === notif\.id\)/);
});
