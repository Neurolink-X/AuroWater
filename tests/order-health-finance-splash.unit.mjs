import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('order health remains admin-only, read-only and paginated', () => {
  const api = read('src/app/api/admin/order-health/route.ts');
  assert.match(api, /requireAdmin\(auth\.ctx\)/);
  assert.match(api, /const limit = 40/);
  assert.match(api, /\.range\(pageRaw \* limit/);
  assert.match(api, /Triage candidates only/);
  assert.doesNotMatch(api, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.match(read('src/components/admin/AdminShell.tsx'), /href: '\/admin\/order-health'/);
});
test('finance paginates rather than silently truncating revenue at the first PostgREST page', () => {
  const api = read('src/app/api/admin/finance/route.ts');
  assert.match(api, /const PAGE_SIZE = 500/);
  assert.match(api, /const MAX_PAGES = 20/);
  assert.match(api, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(api, /if \(!scannedAll\)/);
  assert.match(api, /settlement_verified: false/);
  assert.match(read('src/app/admin/finance/page.tsx'), /not proof of UPI\/bank settlement/);
});
test('brand splash never blocks on font loading and mobile animations stay lightweight', () => {
  const s = read('src/components/SplashController.tsx');
  const layout = read('src/app/layout.tsx');
  assert.match(s, /const MIN_SPLASH_MS = 0/);
  assert.match(s, /const MAX_SPLASH_MS = 350/);
  assert.match(s, /requestAnimationFrame\(hide\)/);
  assert.doesNotMatch(s, /document\.fonts\?\.ready/);
  assert.match(layout, /sp-failsafe \.01s linear \.75s/);
  assert.match(layout, /@media \(pointer:coarse\)/);
});
