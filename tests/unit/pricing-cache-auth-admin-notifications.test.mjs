import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pricingIsVerified, usablePublishedPricingCache } from '../../src/lib/pricing/readiness.ts';

const hook = readFileSync('src/hooks/useSettings.ts', 'utf8');
const admin = readFileSync('src/app/admin/pricing/page.tsx', 'utf8');

test('admin publish event forces fresh verification across city price caches', () => {
  assert.match(admin, /localStorage\.setItem\('aw_pricing_published_at'/);
  assert.match(admin, /dispatchEvent\(new Event\('aurotap:pricing-published'\)\)/);
  assert.match(hook, /event\.key === 'aw_pricing_published_at'/);
  assert.match(hook, /addEventListener\('aurotap:pricing-published'/);
  assert.match(hook, /verifiedCityRef\.current = null;\s*setVerifiedCity\(null\)/);
  assert.equal(usablePublishedPricingCache(9, 1000, 1001, 1002), false);
});

test('authenticated account or city-specific price cannot authorize a different city', () => {
  assert.equal(pricingIsVerified(9, 'noida', 'noida'), true);
  assert.equal(pricingIsVerified(9, 'noida', 'kanpur'), false);
  assert.equal(pricingIsVerified(9, null, 'noida'), false);
  assert.match(hook, /latestVersionCityRef\.current !== cityKey/);
  assert.match(hook, /settingsInFlight\.delete\(city\?\.trim\(\)\.toLowerCase\(\) \|\| ''\)/);
});

test('background refresh never emits admin publish events or notification events', () => {
  const refresh = hook.slice(hook.indexOf('const refresh = React.useCallback'), hook.indexOf('/* ── Mount: serve cache'));
  assert.match(refresh, /apiFetchSettings/);
  assert.doesNotMatch(refresh, /dispatchEvent\(|localStorage\.setItem\('aw_pricing_published_at'/);
  assert.match(hook, /setLoading\(verifiedCityRef\.current !==/);
});
