import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WATER_CAN_PRICES,
  getWaterCanUnitPrice,
  computeExpectedTotal,
  totalsMatch,
  pickGstRateFromFlat,
} from '../src/lib/api/order-pricing-server.ts';
import {
  resolveEffectivePriceBook,
  validateEffectivePriceBook,
} from '../src/lib/pricing/resolve-effective.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('pricing: live water-can prices are canonical; chilled subscriptions fail closed', () => {
  assert.deepEqual(WATER_CAN_PRICES, { normal: 20, chilled: 25, subscription: 20 });
  assert.equal(getWaterCanUnitPrice({ option: 'normal' }), 20);
  assert.equal(getWaterCanUnitPrice({ option: 'chilled' }), 25);
  assert.equal(getWaterCanUnitPrice({ option: 'normal', subscription: true }), 20);
  assert.throws(() => getWaterCanUnitPrice({ option: 'chilled', subscription: true }), /one-time/);
  assert.throws(() => getWaterCanUnitPrice({ option: 'invalid' }), /Invalid/);
});

test('finance: server recomputes whole-rupee GST and never accepts altered totals', () => {
  assert.deepEqual(computeExpectedTotal(100, 10, 5, .18), { gst: 21, total: 136 });
  assert.equal(totalsMatch(136, 100, 10, 5, .18), true);
  assert.equal(totalsMatch(135, 100, 10, 5, .18), false);
  assert.equal(totalsMatch(Number.NaN, 100, 10, 5, .18), false);
  assert.throws(() => computeExpectedTotal(-1, 0, 0, 0), RangeError);
  assert.throws(() => computeExpectedTotal(100, 0, 0, 1.8), RangeError);
  assert.equal(pickGstRateFromFlat({ gst_rate: '18' }), .18);
  assert.equal(pickGstRateFromFlat({ gst_rate: '0.18' }), .18);
  assert.equal(pickGstRateFromFlat({ gst_rate: 'invalid' }), 0);
});

test('pricing: city overrides merge onto the global published book, not replace missing rates', () => {
  const book = resolveEffectivePriceBook({
    water_normal: 22,
    services: { plumbing: 199 },
    city_overrides: {
      noida: { water_normal: 24, services: { ro_service: 499 } },
    },
  }, 'Noida');
  assert.ok(book);
  assert.equal(book.city_key, 'noida');
  assert.equal(book.water_normal, 24);
  assert.equal(book.services.plumbing, 199);
  assert.equal(book.services.ro_service, 499);
  assert.deepEqual(validateEffectivePriceBook(book), []);
  assert.ok(validateEffectivePriceBook({ ...book, water_normal: 1 })
    .some(issue => issue.field === 'water_normal'));
});

test('finance: order confirmation is server-authoritative and supplier settlement remains atomic', () => {
  const orders = read('src/app/api/customer/orders/route.ts');
  const supplier = read('src/app/api/supplier/orders/[id]/route.ts');
  assert.match(orders, /totalsMatch\(clientTotal, netBaseAmount, convenience, emergency_charge, gstRate/);
  assert.match(orders, /computeExpectedTotal\(netBaseAmount, convenience, emergency_charge, gstRate\)/);
  assert.match(orders, /address_id: addr\.id/);
  assert.match(supplier, /\.rpc\('complete_supplier_order_atomic'/);
  assert.match(supplier, /p_payment_collector: parsed\.data\.payment_collector \?\? null/);
  assert.match(supplier, /p_payment_confirmed: parsed\.data\.payment_confirmed === true/);
  assert.match(supplier, /if \(String\(before\.supplier_id \?\? ''\) !== supplierId\)/);
});
