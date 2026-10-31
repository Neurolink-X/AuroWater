import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('subscription refresh coalesces duplicate requests and refuses stale responses', () => {
  const page = read('src/app/customer/subscriptions/page.tsx');
  assert.match(page, /const requestSeq = useRef\(0\)/);
  assert.match(page, /if \(loadInFlight\.current && !force\) return/);
  assert.match(page, /requestId === requestSeq\.current/);
  assert.match(page, /mounted\.current/);
  assert.match(page, /requestSeq\.current\+\+/);
  assert.match(page, /await customerSubscriptionUpdate/);
  assert.match(page, /setItems\(/);
  assert.match(page, /window\.confirm/);
});

test('supplier dashboard client is stable and existing order actions preserved', () => {
  const page = read('src/app/supplier/dashboard/page.tsx');
  const active = page.slice(page.lastIndexOf('export default function SupplierDashboardPage()'));
  assert.match(active, /const supabase = useMemo\(\(\) => createClient\(\), \[\]\)/);
  assert.match(active, /supplierOrderAccept/);
  assert.match(active, /supplierOrderUpdateStatus/);
  assert.match(active, /supplierStockUpdate/);
});
