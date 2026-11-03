import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(path, 'utf8');
const queuePage = file('src/app/admin/dispatch-queue/page.tsx');
const adminShell = file('src/components/admin/AdminShell.tsx');
const dispatchPage = file('src/app/admin/dispatch/page.tsx');
const operations = file('src/app/admin/operations-health/page.tsx');
const dashboard = file('src/app/admin/dashboard/page.tsx');
const dashboardAPI = file('src/app/api/admin/dashboard/route.ts');
const aggregate = file('supabase/migrations/20261103114500_admin_dashboard_revenue_aggregate.sql');

test('queue activation stays guarded and explains missing release approval', () => {
  assert.ok(queuePage.includes('health.release_approved'));
  assert.ok(queuePage.includes('Approval pending'));
  assert.ok(queuePage.includes('Why is Enable disabled?'));
  assert.ok(queuePage.includes('health.activation_ready'));
  assert.ok(queuePage.includes('Queue activation is locked'));
  assert.ok(queuePage.includes('bg-slate-50'));
  assert.ok(queuePage.includes('bg-white'));
  assert.ok(queuePage.includes('text-slate-950'));
  assert.ok(queuePage.includes('disabled={busyToggle || refreshing || health.enabled || !health.activation_ready}'));
  assert.ok(adminShell.includes("href: '/admin/dispatch-queue'"));
  assert.ok(adminShell.includes("'/admin/dispatch-queue'"));
  assert.ok(dispatchPage.includes('Open Queue Management (ON/OFF and health)'));
  assert.ok(operations.includes('bg-slate-50'));
});

test('dashboard refresh does not eagerly scan finance data on every tab', () => {
  assert.ok(dashboard.includes('const ORDER_LIMIT = 80'));
  assert.ok(dashboard.includes('activeTabRef.current'));
  assert.ok(dashboard.includes("activeTabRef.current === 'finance'"));
  assert.ok(dashboard.includes('financeInFlightRef.current'));
  assert.ok(dashboard.includes('financeLastFetchRef.current'));
  assert.ok(dashboard.includes("adminFinance('30d')"));
  assert.ok(dashboard.includes("const POLL_BASE_MS = 60_000"));
});

test('dashboard finance KPIs are aggregated in SQL behind service role', () => {
  assert.ok(aggregate.includes('SECURITY INVOKER'));
  assert.ok(aggregate.includes('FROM public.orders o'));
  assert.ok(aggregate.includes("WHERE o.status='COMPLETED'"));
  assert.ok(aggregate.includes('sum(o.total_amount)'));
  assert.ok(aggregate.includes('unpaid_completed_orders'));
  assert.ok(aggregate.includes('GRANT EXECUTE ON FUNCTION public.admin_dashboard_revenue_aggregate'));
  assert.ok(aggregate.includes('TO service_role'));
  assert.ok(aggregate.includes('FROM PUBLIC, anon, authenticated'));
  assert.ok(!aggregate.includes('UPDATE public.orders'));
  assert.ok(!aggregate.includes('DELETE FROM public.orders'));
  assert.ok(dashboardAPI.includes("createServiceClient().rpc('admin_dashboard_revenue_aggregate'"));
  assert.ok(dashboardAPI.includes('unpaid_completed_orders: unpaidCount'));
  assert.ok(!dashboardAPI.includes("sb.from('orders').select('total_amount').eq('status', 'COMPLETED').eq('payment_status', 'unpaid'),"));
});
