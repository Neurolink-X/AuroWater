import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatSupplierSchedule } from '../src/lib/supplier/schedule-display.ts';

const read = path => readFileSync(path, 'utf8');

test('supplier slots show IST in familiar date and time without UTC date shift', () => {
  assert.match(formatSupplierSchedule('2026-11-02T19:00:00Z', null), /3 Nov 2026.*12:30 am IST/i);
  assert.match(formatSupplierSchedule('2026-11-02', 'Morning'), /2 Nov 2026 · Morning IST/);
  assert.match(formatSupplierSchedule(null, null), /Slot not confirmed/);
});

test('Dispatch and Settings are independent valid routes with preserved order and inventory pages', () => {
  const nav = read('src/components/supplier/SupplierNav.tsx');
  const sections = read('src/app/supplier/[section]/page.tsx');
  assert.match(nav, /href: '\/supplier\/dispatch'/);
  assert.match(nav, /href: '\/supplier\/settings'/);
  assert.match(nav, /href: '\/supplier\/orders'/);
  assert.match(sections, /dispatch: \{ nav: 'Dispatch'/);
  assert.match(sections, /settings: \{ nav: 'Settings'/);
  assert.match(sections, /section === 'dispatch' && <DispatchControl/);
  assert.match(sections, /section === 'settings' && <AccountSettings/);
  assert.doesNotMatch(sections.split('function DispatchControl')[1].split('function AccountSettings')[0], /Object\.entries\(p\.obj\)/);
});

test('dispatch readiness does not use supplier price or bank account as order eligibility', () => {
  const settings = read('src/app/api/supplier/settings/route.ts');
  assert.doesNotMatch(settings.split('function buildReadiness')[1].split('type SnapshotResult')[0], /key: 'price'|key: 'payout'/);
  assert.match(settings, /key: 'stock'/);
  assert.match(settings, /key: 'coverage'/);
  assert.match(settings, /price_per_can: undefined/);
  assert.match(settings, /'supplier_zones'/);
  assert.match(settings, /dispatch_base_city_check/);
  assert.match(settings, /baseLocationMismatch/);
});

test('dashboard does not block order data behind rating or ledger requests', () => {
  const dash = read('src/app/supplier/dashboard/page.tsx');
  assert.match(dash, /void fetchEarnings\(normalized.id\);/);
  assert.match(dash, /await fetchOrders\(\);/);
  assert.match(dash, /void fetchNotifications\(userId\);/);
  assert.match(dash, /o\.scheduled_date === today/);
  assert.match(dash, /if \(filter === 'today'\) return o\.scheduled_date === todayStr/);
  assert.match(dash, /stock\.cans_available - stock\.reserved_cans - stock\.reservation_buffer_cans/);
});

test('payout accounting prevents negative wallet balance appearing as a payable amount', () => {
  const earnings = read('src/app/api/supplier/earnings/route.ts');
  const page = read('src/app/supplier/[section]/page.tsx');
  assert.match(earnings, /ledgerBalance < 0/);
  assert.match(earnings, /pending_payout: balanceRequiresReview \? null : ledgerBalance/);
  assert.match(page, /payoutReview/);
  assert.match(page, /within the verified balance/);
  assert.match(page, /Submitting a request does not move money/);
  assert.match(read('src/app/api/supplier/payouts/route.ts'), /request_supplier_payout/);
});

test('supplier order completion cannot bypass the atomic finance and payment confirmation path', () => {
  const alias = read('src/app/api/supplier/orders/[id]/status/route.ts');
  const canonical = read('src/app/api/supplier/orders/[id]/route.ts');
  const orders = read('src/app/supplier/[section]/page.tsx');
  assert.match(alias, /updateCanonicalSupplierOrder/);
  assert.doesNotMatch(alias, /\.update\(/);
  assert.match(canonical, /complete_supplier_order_atomic/);
  assert.match(canonical, /payment_confirmation_required/);
  assert.match(orders, /platformUpiPending/);
  assert.match(orders, /payment_collector: 'supplier'/);
  assert.match(orders, /Do not collect to a personal UPI ID/);
});

test('supplier operations use real service media already present in public images', () => {
  const dash = read('src/app/supplier/dashboard/page.tsx');
  const sections = read('src/app/supplier/[section]/page.tsx');
  assert.match(dash, /src="\/images\/water_can.webp"/);
  assert.match(sections, /src="\/images\/water_can.webp"/);
});

test('supplier orders remain scoped and payment mutations unchanged', () => {
  const orders = read('src/app/api/supplier/orders/route.ts');
  assert.match(orders, /eq\('supplier_id', auth\.ctx\.profile\.id\)/);
  const settings = read('src/app/api/supplier/settings/route.ts');
  assert.match(settings, /if \(becameOnline\) after\(recoverWaitingOrders\)/);
});
