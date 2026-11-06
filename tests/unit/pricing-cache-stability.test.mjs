import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { usablePublishedPricingCache, shouldRevalidatePublishedPricing, pricingIsVerified } from '../../src/lib/pricing/readiness.ts';

test('server-confirmed published price can be displayed without a fresh request on every navigation', () => {
  assert.equal(usablePublishedPricingCache(8, 100_000, 0, 110_000), true);
  assert.equal(shouldRevalidatePublishedPricing(100_000, 60_000, 110_000), false);
  assert.equal(shouldRevalidatePublishedPricing(100_000, 60_000, 160_000), true);
});
test('admin publishing invalidates older city cached prices and requires verification', () => {
  assert.equal(usablePublishedPricingCache(8, 100_000, 100_001, 100_002), false);
  assert.equal(usablePublishedPricingCache(8, 100_000, 100_000, 100_002), false);
  assert.equal(usablePublishedPricingCache(9, 100_002, 100_001, 100_010), true);
});
test('invalid, unversioned or future-dated cached pricing is never shown as verified', () => {
  for (const version of [undefined, null, 0, -1, 1.5, '9']) {
    assert.equal(usablePublishedPricingCache(version, 100_000, 0, 110_000), false);
  }
  for (const ts of [0, -1, NaN, 120_000]) {
    assert.equal(usablePublishedPricingCache(9, ts, 0, 110_000), false);
  }
});
test('pricing verified for one city never unlocks another city checkout', () => {
  assert.equal(pricingIsVerified(9, 'noida', 'Noida'), true);
  assert.equal(pricingIsVerified(9, 'noida', 'Kanpur'), false);
  assert.equal(pricingIsVerified(9, null, 'Noida'), false);
});
test('routine pricing refresh stays conditional; final checkout remains server authoritative', () => {
  const hook = readFileSync('src/hooks/useSettings.ts', 'utf8');
  const api = readFileSync('src/app/api/customer/orders/route.ts', 'utf8');
  const booking = readFileSync('src/components/booking/BookingWizard.tsx', 'utf8');
  assert.match(hook, /shouldRevalidatePublishedPricing\(ts, staleMs\)/);
  assert.match(hook, /setLoading\(verifiedCityRef\.current !==/);
  assert.match(booking, /!pricingReady \|\| pricingLoading/);
  assert.match(api, /'PRICE_CHANGED'/);
  assert.match(api, /totalsMatch\(/);
});
