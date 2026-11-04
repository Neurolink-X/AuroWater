import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = (path) => readFileSync(path, 'utf8');
const sql = src('supabase/migrations/20261104145000_dispatch_capacity_alert_reliability.sql');
const dispatch = src('src/lib/dispatch.ts');
const supplier = src('src/app/supplier/[section]/page.tsx');
const schedule = src('src/lib/supplier/schedule-display.ts');
const zones = src('src/lib/zones.ts');
const adminOrderApi = src('src/app/api/admin/orders/[id]/route.ts');
const adminOrders = src('src/app/admin/orders/page.tsx');
const adminDispatch = src('src/app/admin/dispatch/page.tsx');
const recoveryApi = src('src/app/api/admin/dispatch/reconfirm/route.ts');
const adminDashboard = src('src/app/admin/dashboard/page.tsx');
const adminDashboardApi = src('src/app/api/admin/dashboard/route.ts');

test('booked time and scheduled delivery are independent, both in IST', () => {
  assert.match(schedule, /export function formatSupplierOrderPlaced/);
  assert.match(schedule, /timeZone: 'Asia\/Kolkata'/);
  assert.match(supplier, /Booked at/);
  assert.match(supplier, /Scheduled delivery/);
  assert.match(supplier, /formatSupplierOrderPlaced\(o\.created_at/);
  assert.match(supplier, /formatSupplierSchedule\(o\.scheduled_at/);
  assert.match(adminOrders, /drawerOrder\.scheduled_at/);
  assert.match(adminOrders, /drawerOrder\.created_at/);
});

test('20-order capacity is enforced atomically on every assignment path', () => {
  assert.match(sql, /max_active_orders integer NOT NULL DEFAULT 20/);
  assert.match(sql, /supplier_max_active_orders','20'/);
  assert.match(sql, /CREATE TRIGGER supplier_order_active_capacity_guard/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /v_used >= least\(20/);
  assert.match(sql, /v_active >= v_cap/);
  assert.match(sql, /SUPPLIER_AT_CAPACITY/);
  assert.match(sql, /IF auth.role\(\) <> 'service_role' THEN/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.try_assign_supplier_with_stock\(uuid,uuid,numeric\) FROM PUBLIC, anon, authenticated/);
  assert.match(dispatch, /MAX_SUPPLIER_ACTIVE_ORDERS = 20/);
  assert.match(dispatch, /Math\.min\(MAX_SUPPLIER_ACTIVE_ORDERS/);
  assert.match(supplier, /Active assignments/);
});

test('overflow is a privacy-safe daily in-app notification, not an extra assignment', () => {
  assert.match(dispatch, /async function notifySupplierAtCapacity/);
  assert.match(dispatch, /supplier_capacity_full_\$\{today\}_\$\{supplierId\}/);
  assert.match(dispatch, /saturatedSuppliers\.push\(\{ id, load \}\)/);
  assert.match(dispatch, /withinSupplierRadius\(distance, radius\)/);
  assert.doesNotMatch(dispatch.slice(dispatch.indexOf('async function notifySupplierAtCapacity'),dispatch.indexOf('async function alertAdmins')), /customer_name|customer_phone|customer_address/);
});

test('retry failures trigger human escalation, and a missed slot is not reassigned', () => {
  assert.match(dispatch, /DISPATCH_ESCALATE_AFTER_FAILURES = 3/);
  assert.match(dispatch, /DISPATCH_STOP_AFTER_FAILURES = 5/);
  assert.match(dispatch, /LATE_SLOT_REVIEW_GRACE_MS = 30 \* 60_000/);
  assert.match(dispatch, /stale_schedule_review/);
  assert.match(dispatch, /manual_dispatch_review/);
  assert.match(dispatch, /retry_state,/);
  assert.match(dispatch, /offer_history,/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.dispatch_alert_events/);
  assert.match(sql, /PRIMARY KEY \(order_id, action\)/);
  assert.match(sql, /s.failures < 5 AND s.next_retry_at <= clock_timestamp\(\)/);
  assert.match(dispatch, /reason: 'stale_schedule_review'/);
  assert.doesNotMatch(sql, /UPDATE public\.orders SET status='CANCELLED'/);
});

test('exact PIN zone wins over overlapping radius when creating bookings', () => {
  assert.match(zones, /let zone: ZoneRow \| null = pinZone/);
  assert.match(zones, /if \(!zone\) zone = nearestRadiusZone\(\)/);
  assert.doesNotMatch(zones, /zone = nearestRadiusZone\(\) \?\? pinZone/);
});

test('customer-confirmed reschedule is role restricted, atomic, audited and separate from dispatch', () => {
  assert.match(recoveryApi, /requireRole\(auth\.ctx, 'admin'\)/);
  assert.match(recoveryApi, /customerConfirmed !== true/);
  assert.match(recoveryApi, /\+05:30/);
  assert.match(recoveryApi, /reconfirm_pending_dispatch_slot/);
  assert.doesNotMatch(recoveryApi, /dispatchOrder\(/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.reconfirm_pending_dispatch_slot\(uuid,timestamptz,uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reconfirm_pending_dispatch_slot\(uuid,timestamptz,uuid\) TO service_role/);
  assert.match(sql, /DELETE FROM public\.dispatch_retry_state WHERE order_id=p_order_id/);
  assert.match(sql, /INSERT INTO public\.audit_logs/);
  assert.match(sql, /INSERT INTO public\.notifications/);
  assert.match(adminDispatch, /customerConfirmed/);
  assert.match(adminDispatch, /Retry dispatch/);
});

test('admin views use stored service_type rather than legacy missing service FK', () => {
  assert.match(adminOrderApi, /const storedServiceKey = typeof row\.service_type/);
  assert.match(adminDashboardApi, /customer_id, service_type/);
  assert.doesNotMatch(adminDashboardApi.slice(adminDashboardApi.indexOf('async function fetchRecentOrders'),adminDashboardApi.indexOf('async function fetchRecentOrders')+600),/service_types \( label \)/);
  assert.match(adminDashboard, /function orderServiceName/);
  assert.match(adminOrders, /Water supplier dispatch/);
  assert.match(adminOrders, /\/admin\/dispatch\?orderId/);
});
