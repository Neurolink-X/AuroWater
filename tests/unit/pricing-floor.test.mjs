import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotal, CAN_PRICES as ENGINE_PRICES } from '../../src/lib/pricing.ts';
import { CAN_PRICES as BOOKING_PRICES } from '../../src/lib/booking-pricing.ts';

const baseInput = (overrides = {}) => ({
  serviceKey: 'water_tanker',
  basePrice: 600,
  convenienceFee: 0,
  gstRate: 0,
  emergencySurcharge: 0,
  emergency: false,
  technicianCommissionRate: 0.7,
  supplierCommissionRate: 0.1,
  canCount: 30,
  pricePerCan: 20,
  monthlyCanCount: 30,
  waterType: 'normal',
  ...overrides,
});

test('approved can prices keep normal, chilled, and subscription minimums', () => {
  assert.equal(ENGINE_PRICES.normal, 20);
  assert.equal(ENGINE_PRICES.chilled, 25);
  assert.equal(BOOKING_PRICES.normal, 20);
  assert.equal(BOOKING_PRICES.chilled, 25);
  assert.equal(BOOKING_PRICES.subscription, 20);
});

test('normal monthly volume discounts cannot reduce below ₹20 per can', () => {
  const result = calculateOrderTotal(baseInput({
    basePrice: 600,
    canCount: 30,
    pricePerCan: 20,
    waterType: 'normal',
  }));
  assert.equal(result.total, 600);
  assert.equal(result.volumeDiscount, 0);
  assert.equal(result.valid, true);
});

test('chilled monthly volume discounts cannot reduce below ₹25 per can', () => {
  const result = calculateOrderTotal(baseInput({
    basePrice: 750,
    canCount: 30,
    pricePerCan: 25,
    waterType: 'chilled',
  }));
  assert.equal(result.total, 750);
  assert.equal(result.volumeDiscount, 0);
  assert.equal(result.valid, true);
});

test('a low supplied unit price is raised to the approved floor before calculating totals', () => {
  const normal = calculateOrderTotal(baseInput({
    basePrice: 18,
    canCount: 1,
    pricePerCan: 18,
    monthlyCanCount: 1,
    waterType: 'normal',
  }));
  const chilled = calculateOrderTotal(baseInput({
    basePrice: 18,
    canCount: 1,
    pricePerCan: 18,
    monthlyCanCount: 1,
    waterType: 'chilled',
  }));
  assert.equal(normal.total, 20);
  assert.equal(chilled.total, 25);
});

test('coupon discounts cannot take the water-can subtotal below the minimum', () => {
  const result = calculateOrderTotal(baseInput({
    basePrice: 30,
    canCount: 1,
    pricePerCan: 30,
    monthlyCanCount: 1,
    waterType: 'normal',
    coupon: { code: 'HALF', type: 'percent', value: 50 },
  }));
  assert.equal(result.total, 20);
  assert.equal(result.discountAmount, 10);
  assert.equal(result.valid, true);
});
