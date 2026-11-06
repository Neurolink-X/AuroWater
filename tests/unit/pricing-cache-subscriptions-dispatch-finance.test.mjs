import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldRevalidatePublishedPricing } from '../../src/lib/pricing/readiness.ts';

const booking = readFileSync('src/components/booking/BookingWizard.tsx', 'utf8');
const orders = readFileSync('src/app/api/customer/orders/route.ts', 'utf8');

test('subscriptions and booking cannot submit unverified pricing or missing address', () => {
  assert.match(booking, /if \(!pricingReady \|\| pricingLoading\)/);
  assert.match(booking, /if \(!draft\.addressId \|\| !session\?\.loggedIn\)/);
  assert.match(booking, /can_order_type:\s+draft\.serviceKey === 'water_can'/);
  assert.match(booking, /can_frequency:.*draft\.serviceKey === 'water_can'/);
  assert.ok(booking.indexOf('if (!pricingReady || pricingLoading)') < booking.indexOf('customerOrderCreate({'));
});

test('dispatch and finance checkout still recompute total on the server and reject mismatch', () => {
  assert.match(orders, /totalsMatch\(clientTotal, netBaseAmount, convenience, emergency_charge, gstRate, 0\.5\)/);
  assert.match(orders, /computeExpectedTotal\(netBaseAmount, convenience, emergency_charge, gstRate\)/);
  assert.match(orders, /'PRICE_CHANGED'/);
  assert.match(booking, /errCode === 'PRICE_CHANGED'/);
  assert.match(orders, /address_snapshot/);
});

test('routine visibility checks do not launch a network refresh while cache is fresh', () => {
  assert.equal(shouldRevalidatePublishedPricing(100_000, 60_000, 110_000), false);
  assert.equal(shouldRevalidatePublishedPricing(100_000, 60_000, 160_000), true);
  assert.equal(shouldRevalidatePublishedPricing(100_000, 60_000, 90_000), true);
});
