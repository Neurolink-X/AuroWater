/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

/**
 * Per-zone marketplace health for the last N days (default 30, max 180).
 * Contribution margin needs the ledger (not built yet), so it is intentionally absent.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days') ?? '30') || 30, 1), 180);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = Date.now() - 7 * 86_400_000;

  const db: any = createServiceClient();

  const [ordersRes, linksRes, onlineRes] = await Promise.all([
    db
      .from('orders')
      .select('zone_id, customer_id, status, total_amount, created_at, assigned_at, completed_at')
      .not('zone_id', 'is', null)
      .gte('created_at', since)
      .limit(10000),
    db.from('supplier_zones').select('supplier_id, zone_id'),
    db.from('supplier_settings').select('user_id').eq('is_online', true),
  ]);

  if (ordersRes.error) {
    console.error('[admin/zones/metrics] orders query failed:', ordersRes.error);
    return jsonErr('Could not load zone metrics', 500);
  }

  const online = new Set(((onlineRes.data ?? []) as { user_id: string }[]).map((r) => String(r.user_id)));
  const suppliersByZone = new Map<string, { total: number; online: number }>();
  for (const l of (linksRes.data ?? []) as { supplier_id: string; zone_id: string }[]) {
    const z = String(l.zone_id);
    const cur = suppliersByZone.get(z) ?? { total: 0, online: 0 };
    cur.total += 1;
    if (online.has(String(l.supplier_id))) cur.online += 1;
    suppliersByZone.set(z, cur);
  }

  type Acc = {
    orders: number;
    today: number;
    week: number;
    completed: number;
    cancelled: number;
    revenue: number;
    respSum: number;
    respN: number;
    fulfilSum: number;
    fulfilN: number;
    perCustomer: Map<string, number>;
  };
  const acc = new Map<string, Acc>();

  for (const o of (ordersRes.data ?? []) as any[]) {
    const z = String(o.zone_id);
    let a = acc.get(z);
    if (!a) {
      a = { orders: 0, today: 0, week: 0, completed: 0, cancelled: 0, revenue: 0, respSum: 0, respN: 0, fulfilSum: 0, fulfilN: 0, perCustomer: new Map() };
      acc.set(z, a);
    }
    const created = new Date(o.created_at).getTime();
    const status = String(o.status ?? '').toUpperCase();
    a.orders += 1;
    if (created >= startOfToday.getTime()) a.today += 1;
    if (created >= weekAgo) a.week += 1;
    if (o.customer_id) a.perCustomer.set(String(o.customer_id), (a.perCustomer.get(String(o.customer_id)) ?? 0) + 1);
    if (status === 'COMPLETED') {
      a.completed += 1;
      a.revenue += Number(o.total_amount ?? 0) || 0;
      if (o.completed_at) {
        a.fulfilSum += (new Date(o.completed_at).getTime() - created) / 60_000;
        a.fulfilN += 1;
      }
    }
    if (status === 'CANCELLED' || status === 'FAILED') a.cancelled += 1;
    if (o.assigned_at) {
      a.respSum += (new Date(o.assigned_at).getTime() - created) / 60_000;
      a.respN += 1;
    }
  }

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const out = [...acc.entries()].map(([zone_id, a]) => {
    const customers = a.perCustomer.size;
    const repeaters = [...a.perCustomer.values()].filter((n) => n >= 2).length;
    const sup = suppliersByZone.get(zone_id) ?? { total: 0, online: 0 };
    return {
      zone_id,
      days,
      orders: a.orders,
      orders_today: a.today,
      orders_week: a.week,
      completed: a.completed,
      cancelled: a.cancelled,
      completion_rate: pct(a.completed, a.orders),
      cancellation_rate: pct(a.cancelled, a.orders),
      avg_order_value: a.completed ? r1(a.revenue / a.completed) : null,
      avg_response_min: a.respN ? r1(a.respSum / a.respN) : null,
      avg_fulfillment_min: a.fulfilN ? r1(a.fulfilSum / a.fulfilN) : null,
      customers,
      repeat_rate: pct(repeaters, customers),
      revenue: Math.round(a.revenue * 100) / 100,
      suppliers: sup.total,
      suppliers_online: sup.online,
    };
  });

  return jsonOk(out);
}
