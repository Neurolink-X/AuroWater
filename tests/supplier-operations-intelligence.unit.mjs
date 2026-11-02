import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  istSlot, tomorrowInIST, forecastSupplierStock, supplierPerformance,
  groupAcceptedDeliveries, rankCoverageOpportunities,
} from '../src/lib/supplier/intelligence.ts';

const read = p => readFileSync(p, 'utf8');
const now = new Date('2026-11-02T08:00:00.000Z');

test('IST conversion and next day are deterministic across UTC boundaries', () => {
  assert.equal(istSlot('2026-11-02T19:00:00.000Z').date, '2026-11-03');
  assert.equal(tomorrowInIST(now).date, '2026-11-03');
});

test('forecast does not invent future demand with insufficient history', () => {
  const summary = forecastSupplierStock([], { cans_available: 20, reserved_cans: 4, reservation_buffer_cans: 3 }, now);
  assert.equal(summary.estimated_cans, null);
  assert.equal(summary.refill_suggestion, 0);
  assert.equal(summary.free_stock, 13);
  assert.equal(summary.confidence, 'insufficient');
});

test('forecast respects reserved stock and confirmed orders but never changes inventory', () => {
  const history = [7, 14, 21, 28, 35, 42].map(days => ({
    id: String(days), status: 'COMPLETED', service_type: 'water_can', can_count: 5,
    created_at: new Date(now.getTime() - days * 86400000).toISOString(),
    scheduled_at: new Date(now.getTime() - days * 86400000).toISOString(),
  }));
  history.push({
    id: 'future', status: 'ASSIGNED', service_type: 'water_can', can_count: 12,
    created_at: now.toISOString(), scheduled_at: '2026-11-03T08:00:00Z',
  });
  const stock = { cans_available: 10, reserved_cans: 4, reservation_buffer_cans: 2 };
  const original = { ...stock };
  const forecast = forecastSupplierStock(history, stock, now);
  assert.equal(forecast.free_stock, 4);
  assert.equal(forecast.confirmed_cans, 12);
  assert.ok(forecast.suggested_target >= 12);
  assert.ok(forecast.refill_suggestion >= 8);
  assert.deepEqual(stock, original);
});

test('route groups contain only accepted assigned or in-progress deliveries', () => {
  const orders = [
    { id: 'accepted', status: 'ASSIGNED', accepted_at: now.toISOString(), service_type: 'water_can',
      can_count: 3, address_id: 'adr1', scheduled_at: '2026-11-03T03:30:00Z' },
    { id: 'not-accepted', status: 'ASSIGNED', accepted_at: null, service_type: 'water_can',
      can_count: 8, address_id: 'adr2', scheduled_at: '2026-11-03T04:00:00Z' },
    { id: 'active', status: 'IN_PROGRESS', service_type: 'water_can',
      can_count: 2, address_id: 'adr1', scheduled_at: '2026-11-03T05:00:00Z' },
  ];
  const batches = groupAcceptedDeliveries(orders, { adr1: '208001', adr2: '208002' }, now);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].pincode, '208001');
  assert.equal(batches[0].orders, 2);
  assert.equal(batches[0].cans, 5);
  assert.equal(JSON.stringify(batches).includes('adr1'), false);
});

test('performance does not confuse rejected offers with cancellations or missed sales', () => {
  const perf = supplierPerformance([
    { id: 'a', status: 'COMPLETED', service_type: 'water_can', can_count: 2 },
    { id: 'b', status: 'CANCELLED', service_type: 'water_can', can_count: 5 },
  ], [{ status: 'ACCEPTED' }, { status: 'REJECTED' }, { status: 'EXPIRED' }]);
  assert.equal(perf.completed_orders, 1);
  assert.equal(perf.completed_water_cans, 2);
  assert.equal(perf.cancelled_orders, 1);
  assert.equal(perf.rejected_or_expired_offers, 2);
  assert.equal(perf.offer_acceptance_pct, 33);
});

test('coverage gaps require complete scan and at least five distinct customers', () => {
  const zones = [{ id: 'zone1', name: 'North', city: 'Kanpur', status: 'AVAILABLE', center_lat: 26.45,
    center_lng: 80.33, services: ['water_can'] }];
  const demand = [1, 2, 3, 4, 5].map(x => ({
    zone_id: 'zone1', customer_id: 'c' + x, service_type: 'water_can', status: 'COMPLETED',
  }));
  const loc = { lat: 26.45, lng: 80.33 };
  assert.equal(rankCoverageOpportunities(zones, demand, [], 'supplier1', loc, false).length, 0);
  assert.equal(rankCoverageOpportunities(zones, demand.slice(0, 4), [], 'supplier1', loc, true).length, 0);
  const results = rankCoverageOpportunities(zones, demand, [], 'supplier1', loc, true);
  assert.equal(results.length, 1);
  assert.equal(results[0].request_count_30d, 5);
  assert.equal(results[0].action, 'request_coverage');
  assert.equal(JSON.stringify(results).includes('customer_id'), false);
  assert.equal(rankCoverageOpportunities(zones, demand, [], 'supplier1', { lat: 28, lng: 77 }, true).length, 0);
});

test('supplier intelligence endpoints remain role-scoped and non-mutating', () => {
  const api = read('src/app/api/supplier/intelligence/route.ts');
  const page = read('src/app/supplier/[section]/page.tsx');
  const coverage = read('src/app/supplier/coverage/page.tsx');
  assert.match(api, /requireRole\(auth\.ctx, 'supplier'\)/);
  assert.match(api, /\.eq\('supplier_id', supplierId\)/);
  assert.match(api, /\.limit\(OWN_LIMIT \+ 1\)/);
  assert.match(api, /\.limit\(DEMAND_LIMIT \+ 1\)/);
  assert.match(api, /private, no-store/);
  assert.doesNotMatch(api, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  assert.match(page, /endpoint: '\/api\/supplier\/intelligence'/);
  assert.match(coverage, /suggestedZone/);
  assert.doesNotMatch(coverage, /autoApprove/);
});
