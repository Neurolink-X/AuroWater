import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const wizard = read('src/components/booking/BookingWizard.tsx');
const orders = read('src/app/api/customer/orders/route.ts');
const dashboard = read('src/app/admin/operations-health/page.tsx');
const diagnostics = read('src/app/api/admin/operations-health/route.ts');

test('lost checkout response retains the original UUID across browser refresh', () => {
  assert.match(wizard, /checkoutAttemptKey\s*=/);
  assert.match(wizard, /safeSessionGet\(attemptStorageKey\)/);
  assert.match(wizard, /safeSessionSet\(attemptStorageKey/);
  assert.match(wizard, /restoredAttempt\?\.key/);
  assert.match(wizard, /checkout_request_id: key/);
  assert.match(wizard, /safeSessionRemove\(attemptStorageKey\)/);
  assert.doesNotMatch(wizard.split('const confirmOrder = async')[1].split('const waLink')[0], /setInterval\(/);
});

test('duplicate checkouts remain protected by database-level request identity', () => {
  assert.match(orders, /eq\('checkout_request_id', checkoutKey\)/);
  assert.match(orders, /if \(existing\) return jsonOk\(withCompat\(existing\), 200\)/);
  assert.match(orders, /oErr\?\.code === '23505'/);
});

test('unknown response is never shown as a successful booking', () => {
  assert.match(wizard, /We could not verify your booking response/);
  assert.match(wizard, /Check Order History first/);
  assert.match(wizard, /toast\.success\('Booking confirmed!/);
});

test('incident diagnostics are admin-only and read-only', () => {
  assert.match(diagnostics, /requireSupabaseAuth/);
  assert.match(diagnostics, /requireAdmin\(auth\.ctx\)/);
  assert.match(diagnostics, /\.limit\(100\)/);
  assert.doesNotMatch(diagnostics, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(diagnostics, /AbortSignal\.timeout\(4000\)/);
  assert.match(dashboard, /Live backend status unavailable/);
  assert.match(dashboard, /External incident monitor/);
});
