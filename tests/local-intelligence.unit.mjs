import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  isDispatchEligibleSupplier,
  normalizePincode,
  summarizeLocalDemand,
  summarizeSupplierOutcomes,
} from '../src/lib/local-intelligence.ts';

test('PIN normalization accepts exactly six digits and rejects malformed values', () => {
  assert.equal(normalizePincode('208001'), '208001');
  assert.equal(normalizePincode(208001), '208001');
  assert.equal(normalizePincode(' 208-001 '), '208001');
  assert.equal(normalizePincode('20801'), null);
  assert.equal(normalizePincode('1208001'), null);
  assert.equal(normalizePincode(null), null);
});

test('supplier eligibility mirrors dispatch safety gates without penalizing missing legacy verification', () => {
  assert.equal(isDispatchEligibleSupplier({ id: '1', role: 'supplier', is_active: true, status: 'active', verification_status: 'approved' }), true);
  assert.equal(isDispatchEligibleSupplier({ id: '2', role: 'supplier', is_active: true, status: 'active', verification_status: null }), true);
  assert.equal(isDispatchEligibleSupplier({ id: '3', role: 'supplier', is_active: false, status: 'active', verification_status: 'approved' }), false);
  assert.equal(isDispatchEligibleSupplier({ id: '4', role: 'supplier', is_active: true, status: 'suspended', verification_status: 'approved' }), false);
  assert.equal(isDispatchEligibleSupplier({ id: '5', role: 'supplier', is_active: true, status: 'active', verification_status: 'pending' }), false);
  assert.equal(isDispatchEligibleSupplier({ id: '6', role: 'customer', is_active: true, status: 'active' }), false);
});

test('local demand summary finds cancellation hotspots, unassigned orders, service mix and India peak hour', () => {
  const orders = [
    { id: '1', customer_id: 'c1', created_at: '2026-10-27T12:30:00.000Z', status: 'COMPLETED', supplier_id: 's1', service_type: 'water_can', address_snapshot: { pincode: '208001', city: 'Kanpur' } },
    { id: '2', customer_id: 'c2', created_at: '2026-10-27T12:40:00.000Z', status: 'CANCELLED', supplier_id: null, service_type: 'water_can', address_snapshot: { pincode: '208001', city: 'Kanpur' } },
    { id: '3', customer_id: 'c1', created_at: '2026-10-27T13:00:00.000Z', status: 'PENDING', supplier_id: null, service_type: 'water_can', address: 'Customer address, 208001' },
    { id: '4', customer_id: 'c3', created_at: '2026-10-27T13:10:00.000Z', status: 'FAILED', supplier_id: null, service_type: 'plumbing', address_snapshot: { pincode: '201301', city: 'Noida' } },
    { id: '5', customer_id: 'c3', created_at: 'not-a-date', status: 'ASSIGNED', supplier_id: 's2', service_type: 'plumbing', address_snapshot: { pincode: '201301', city: 'Noida' } },
    { id: '6', created_at: null, status: 'PENDING', supplier_id: null, service_type: 'water_can', address_snapshot: { city: 'Kanpur' } },
  ];
  const summary = summarizeLocalDemand(orders, new Map([['201301', 2]]), 30);
  assert.equal(summary.ordersReviewed, 6);
  assert.equal(summary.uniqueCustomers, 3);
  assert.equal(summary.repeatCustomers, 2);
  assert.equal(summary.repeatCustomerRate, 66.7);
  assert.equal(summary.ordersWithPincode, 5);
  assert.equal(summary.ordersWithoutPincode, 1);
  assert.equal(summary.cancelledOrders, 2);
  assert.equal(summary.unassignedOrders, 2);
  assert.equal(summary.peakHour, 18); // 12:30 UTC = 18:00 IST
  assert.equal(summary.peakHourOrders, 4);
  assert.equal(summary.demandByPincode[0].pincode, '208001');
  assert.equal(summary.demandByPincode[0].orders, 3);
  assert.equal(summary.demandByPincode[0].coverageGap, true);
  assert.equal(summary.demandByPincode[1].pincode, '201301');
  assert.equal(summary.demandByPincode[1].mappedSuppliers, 2);
  assert.equal(summary.demandByPincode[1].coverageGap, false);
  assert.deepEqual(summary.serviceMix.map((item) => [item.service, item.orders]), [['water_can', 4], ['plumbing', 2]]);
});

test('summary handles empty datasets without fake metrics', () => {
  const summary = summarizeLocalDemand([], new Map());
  assert.equal(summary.ordersReviewed, 0);
  assert.equal(summary.cancellationRate, 0);
  assert.equal(summary.peakHour, null);
  assert.deepEqual(summary.demandByPincode, []);
  assert.deepEqual(summary.serviceMix, []);
});


test('admin Local Intelligence endpoint remains protected, read-only, and bounded', () => {
  const route = readFileSync(new URL('../src/app/api/admin/local-intelligence/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/app/admin/local-intelligence/page.tsx', import.meta.url), 'utf8');
  assert.match(route, /requireRole\(auth\.ctx, 'admin'\)/);
  assert.match(route, /MAX_ORDERS = 1000/);
  assert.match(route, /\.from\('orders'\)/);
  assert.match(route, /\.from\('supplier_stock'\)/);
  assert.match(route, /\.select\('\*'\).*Optional profile columns vary/s);
  assert.match(route, /\.from\('supplier_zones'\)/);
  assert.match(route, /\.from\('service_zones'\)/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.match(page, /Supplier stock visibility/);
  assert.match(page, /30_000/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /No automatic supplier ranking or dispatch changes/);
});


test('supplier outcome metrics use assigned orders and ignore invalid ratings', () => {
  const outcomes = summarizeSupplierOutcomes([
    { supplier_id: 's1', status: 'COMPLETED', rating: 5 },
    { supplier_id: 's1', status: 'COMPLETED', rating: 4 },
    { supplier_id: 's1', status: 'CANCELLED', rating: null },
    { supplier_id: 's1', status: 'PENDING', rating: null },
    { supplier_id: 's2', status: 'COMPLETED', rating: 6 },
    { supplier_id: 's2', status: 'FAILED', rating: null },
    { supplier_id: null, status: 'CANCELLED', rating: null },
  ], new Map([
    ['s1', { name: 'Supplier One', city: 'Kanpur' }],
    ['s2', { name: 'Supplier Two', city: 'Noida' }],
  ]));
  assert.equal(outcomes.length, 2);
  assert.equal(outcomes[0].supplierId, 's1');
  assert.equal(outcomes[0].assignedOrders, 4);
  assert.equal(outcomes[0].completedOrders, 2);
  assert.equal(outcomes[0].cancelledOrFailedOrders, 1);
  assert.equal(outcomes[0].completionRate, 50);
  assert.equal(outcomes[0].averageRating, 4.5);
  assert.equal(outcomes[0].ratedOrders, 2);
  assert.equal(outcomes[1].averageRating, null);
});
