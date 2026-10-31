import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('safe repair only proposes allowlisted changes and never auto merges', () => {
  const flow = read('.github/workflows/auto-repair-safe.yml');
  assert.match(flow, /eslint-suppressions\.json/);
  assert.match(flow, /npm run test:unit/);
  assert.match(flow, /npm run test:regression/);
  assert.doesNotMatch(flow, /gh pr merge|vercel deploy|supabase db|git push.*main/);
});
test('postal intelligence is admin only and never claims bookability from PIN alone', () => {
  const endpoint = read('src/app/api/admin/postal-intelligence/route.ts');
  const admin = read('src/components/admin/AdminShell.tsx');
  assert.match(endpoint, /requireAdmin\(auth.ctx\)/);
  assert.match(endpoint, /delivery_bookable: null/);
  assert.match(endpoint, /\.eq\('pincode', pin\)/);
  assert.match(endpoint, /\.contains\('pincodes', \[pin\]\)/);
  assert.match(admin, /href: '\/admin\/postal-intelligence'/);
});
test('role polling coalesces requests and rewards link to subscriptions', () => {
  const supplier = read('src/app/supplier/[section]/page.tsx');
  const tech = read('src/app/technician/jobs/page.tsx');
  const rewards = read('src/app/customer/loyalty/page.tsx');
  const subs = read('src/app/customer/subscriptions/page.tsx');
  assert.match(supplier, /const POLL_MS = 30_000/);
  assert.match(supplier, /backgroundFetchInFlight\.current/);
  assert.match(tech, /lastBackgroundRefresh/);
  assert.match(tech, /\}, 30000\)/);
  assert.match(rewards, /href="\/customer\/subscriptions"/);
  assert.match(subs, /href="\/customer\/loyalty"/);
});
