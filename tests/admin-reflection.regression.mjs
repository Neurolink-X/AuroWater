import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('public pricing is never cached by a shared edge cache', () => {
  const source = read('src/app/api/settings/route.ts');
  assert.match(source, /force-dynamic/);
  assert.match(source, /no-store/);
  assert.doesNotMatch(source, /stale-while-revalidate/);
});
test('admin publishing invalidates price-bearing routes', () => {
  const source = read('src/app/api/admin/pricing/route.ts');
  assert.match(source, /publish_pricing_version/);
  assert.match(source, /revalidatePath\(route\)/);
});
test('public cities use database statuses, never merge missing fallback active cities', () => {
  const source = read('src/app/api/cities/route.ts');
  assert.match(source, /force-dynamic/);
  assert.match(source, /no-store/);
  assert.doesNotMatch(source, /if \(!merged\.has\(key\)\)/);
});
test('city activation checks coverage and supplier capacity', () => {
  const source = read('src/app/api/admin/cities/route.ts');
  assert.match(source, /service_zones/);
  assert.match(source, /supplier_zones/);
  assert.match(source, /supplier_stock/);
  assert.match(source, /revalidatePath\('\/service-areas'\)/);
});
test('settings refresh when returning to an existing tab', () => {
  const source = read('src/hooks/useSettings.ts');
  assert.match(source, /visibilitychange/);
  assert.match(source, /window\.addEventListener\('focus'/);
});
test('city pricing retains global service rates when city overrides are partial', () => {
  const source = read('src/app/api/settings/route.ts');
  assert.match(source, /resolveEffectivePriceBook\(activeVersion\.config/);
  const resolver = read('src/lib/pricing/resolve-effective.ts');
  assert.match(resolver, /\.\.\.globalServices, \.\.\.cityServices/);
});
