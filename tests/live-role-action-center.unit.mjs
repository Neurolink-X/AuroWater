import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('supplier priorities come from assigned orders and actual unreserved stock', () => {
  const source = get('src/app/supplier/dashboard/page.tsx');
  const active = source.slice(source.lastIndexOf('export default function SupplierDashboardPage()'));
  assert.match(active, /<LiveOperationsActionCenter/);
  assert.match(active, /Number\(stock\.cans_available \|\| 0\)/);
  assert.match(active, /Number\(stock\.reserved_cans \|\| 0\)/);
  assert.match(active, /Number\(stock\.reservation_buffer_cans \|\| 0\)/);
  assert.match(active, /!order\.accepted_at/);
  assert.match(active, /href: '\/supplier\/earnings'/);
});
test('technician priorities derive from realtime-backed job state, not mock payouts', () => {
  const source = get('src/app/technician/dashboard/page.tsx');
  const active = source.slice(source.indexOf('export default function TechnicianDashboardPage()'));
  assert.match(active, /value: String\(offers\.length\)/);
  assert.match(active, /value: String\(stageCounts\.in_progress\)/);
  assert.match(active, /value: String\(stageCounts\.upcoming\)/);
  assert.match(active, /tab === 'overview' && <LiveOperationsActionCenter/);
});
test('shared component supports accessible action links and truthful context', () => {
  const source = get('src/components/operations/LiveOperationsActionCenter.tsx');
  assert.match(source, /aria-label=\{title\}/);
  assert.match(source, /loading \? '—' : card\.value/);
  assert.match(source, /Live account data/);
  assert.match(source, /<Link href=\{card\.href\}/);
});
