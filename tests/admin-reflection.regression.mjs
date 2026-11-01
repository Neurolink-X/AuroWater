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

test('sparse published pricing stays bookable using approved defaults while city patches win', () => {
  const resolver = read('src/lib/pricing/resolve-effective.ts');
  assert.match(resolver, /water_normal: 20/);
  assert.match(resolver, /water_chilled: 25/);
  assert.match(resolver, /water_tanker_1000: 300/);
  assert.match(resolver, /water_tanker_custom: 0/);
  assert.match(resolver, /\.\.\.baseline\.services, \.\.\.published\.services/);
  assert.match(resolver, /\.\.\.globalServices, \.\.\.cityServices/);
  assert.match(resolver, /Object\.hasOwn\(published, 'services'\)/);
});

test('Noida legacy coverage matches the production launch radius', () => {
  const geo = read('src/lib/geo.ts');
  assert.match(geo, /city: 'Noida'.*radiusKm: 25/);
  const migration = read('sql/launch_booking_city_catalog_20261101.sql');
  assert.match(migration, /ON CONFLICT \(slug\) DO UPDATE/);
  assert.match(migration, /is_active = true/);
  assert.match(migration, /services = NULL/);
  assert.match(migration, /radius_km = CASE WHEN lower\(city\) = 'noida' THEN 25/);
});

test('launch migration creates citywide available catch-all zones for all requested cities', () => {
  const migration = read('sql/launch_booking_city_catalog_20261101.sql');
  for (const city of ['kanpur', 'lucknow', 'noida', 'gorakhpur']) {
    assert.match(migration, new RegExp(city));
  }
  assert.match(migration, /is_catch_all, notes/);
  assert.match(migration, /'AVAILABLE'/);
  assert.match(migration, /services = NULL/);
  assert.match(migration, /ON CONFLICT \(slug\) DO UPDATE/);
});
test('serviceability keeps listed full cities available through legacy fallback', () => {
  const zones = read('src/lib/zones.ts');
  assert.match(zones, /isCityServed\(city\) \|\| \(hasCoords && getServiceZone\(lat, lng\) !== null\)/);
});
