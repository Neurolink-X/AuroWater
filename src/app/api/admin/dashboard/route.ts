// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireAdmin(auth.ctx)) {
//     return jsonErr('Forbidden', 403);
//   }

//   const sb = auth.ctx.supabase;
//   const startDay = new Date();
//   startDay.setHours(0, 0, 0, 0);
//   const startIso = startDay.toISOString();

//   const [
//     totalOrders,
//     todayOrders,
//     totalRevenue,
//     revenueToday,
//     activeJobs,
//     totalCustomers,
//     totalTechnicians,
//     recentOrders,
//   ] = await Promise.all([
//     sb.from('orders').select('*', { count: 'exact', head: true }),
//     sb.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', startIso),
//     sb.from('orders').select('total_amount').eq('status', 'COMPLETED'),
//     sb
//       .from('orders')
//       .select('total_amount')
//       .eq('status', 'COMPLETED')
//       .gte('created_at', startIso),
//     sb
//       .from('orders')
//       .select('*', { count: 'exact', head: true })
//       .in('status', ['PENDING', 'ASSIGNED', 'IN_PROGRESS']),
//     sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
//     sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician'),
//     sb.from('orders').select('*').order('created_at', { ascending: false }).limit(10),
//   ]);

//   const revSum = (rows: { total_amount: unknown }[] | null) =>
//     (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

//   const payload = {
//     kpis: {
//       total_orders: totalOrders.count ?? 0,
//       todays_orders: todayOrders.count ?? 0,
//       total_revenue: revSum(totalRevenue.data),
//       revenue_today: revSum(revenueToday.data),
//       active_jobs: activeJobs.count ?? 0,
//       emergency_bookings: 0,
//       total_customers: totalCustomers.count ?? 0,
//       total_technicians: totalTechnicians.count ?? 0,
//     },
//     recent_orders: recentOrders.data ?? [],
//     charts: {
//       orders_daily: [] as { day: string; count: number }[],
//       revenue_daily: [] as { day: string; total: number }[],
//     },
//   };

//   return jsonOk(payload);
// }


/**
 * GET /api/admin/dashboard
 *
 * Upgrades over the original:
 *  ✓ safe() wrapper — one failing query never kills the whole response
 *  ✓ Real 7-day chart data built in JS (no empty arrays sent to UI)
 *  ✓ Week-over-week growth % on orders + revenue
 *  ✓ Emergency bookings — real DB count, not hardcoded 0
 *  ✓ pending_kyc + fraud_alerts counts for admin alert badges
 *  ✓ Top-5 suppliers by completed-order revenue (last 30 days)
 *  ✓ online_technicians live count
 *  ✓ Cache-Control: stale-while-revalidate=15 — cuts DB load for polling UIs
 *  ✓ Fully typed — no `any` / `unknown` leaks in the public response
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface DayOrder   { day: string; count: number }
interface DayRevenue { day: string; total: number }
interface SupplierStat {
  supplier_id: string;
  name:        string | null;
  total:       number;
  orders:      number;
}
interface OrderRow {
  id:            string;
  status:        string;
  total_amount:  number | null;
  created_at:    string;
  customer_name: string | null;
  service_type:  string | null;
  is_emergency:  boolean | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Wrap every Supabase call so a single failure doesn't abort Promise.all.
 *
 *  Parameter is `PromiseLike` not `Promise`:
 *  `PostgrestFilterBuilder` only implements `.then()` (PromiseLike),
 *  NOT the full Promise interface (.catch / .finally / [Symbol.toStringTag]).
 *  Using `Promise<T>` here causes "missing properties from type Promise" errors
 *  on every call site. `PromiseLike<T>` accepts any thenable, including
 *  Supabase query builders, without losing type safety on the resolved value.
 */
async function safe<T>(
  p: PromiseLike<{ data: T | null; error: unknown; count?: number | null }>
): Promise<{ data: T | null; count: number }> {
  try {
    const { data, error, count } = await p;
    return { data: error ? null : data, count: count ?? 0 };
  } catch {
    return { data: null, count: 0 };
  }
}

/** Safely sum total_amount from any result set */
const revSum = (rows: Array<{ total_amount: unknown }> | null): number =>
  (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

/** ISO start-of-day N days ago */
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Week-over-week growth percentage */
function growth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/* ── Chart builders (JS bucketing — works without custom RPC) ────────────── */

async function buildDailyOrders(sb: SupabaseClient, days = 7): Promise<DayOrder[]> {
  const from = daysAgoISO(days);
  const { data } = await sb
    .from('orders')
    .select('created_at')
    .gte('created_at', from)
    .order('created_at', { ascending: true });

  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const day = (r.created_at as string).slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }

  const result: DayOrder[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    result.push({ day, count: map.get(day) ?? 0 });
  }
  return result;
}

async function buildDailyRevenue(sb: SupabaseClient, days = 7): Promise<DayRevenue[]> {
  const from = daysAgoISO(days);
  const { data } = await sb
    .from('orders')
    .select('created_at, total_amount')
    .eq('status', 'COMPLETED')
    .gte('created_at', from)
    .order('created_at', { ascending: true });

  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const day = (r.created_at as string).slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + Number(r.total_amount ?? 0));
  }

  const result: DayRevenue[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    result.push({ day, total: map.get(day) ?? 0 });
  }
  return result;
}

async function buildTopSuppliers(sb: SupabaseClient): Promise<SupplierStat[]> {
  const from = daysAgoISO(30);
  const { data } = await sb
    .from('orders')
    .select('supplier_id, total_amount, profiles!orders_supplier_id_fkey ( full_name )')
    .eq('status', 'COMPLETED')
    .gte('created_at', from);

  if (!data) return [];

  const map = new Map<string, { name: string | null; total: number; orders: number }>();

  for (const r of data as Array<{
    supplier_id: string | null;
    total_amount: unknown;
    profiles: Array<{ full_name: string }> | null;
  }>) {
    if (!r.supplier_id) continue;
    const prev  = map.get(r.supplier_id) ?? { name: r.profiles?.[0]?.full_name ?? null, total: 0, orders: 0 };
    map.set(r.supplier_id, {
      name:   prev.name,
      total:  prev.total + Number(r.total_amount ?? 0),
      orders: prev.orders + 1,
    });
  }

  return Array.from(map.entries())
    .map(([supplier_id, v]) => ({ supplier_id, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

/** Fetch recent orders with customer name in one query */
async function fetchRecentOrders(sb: SupabaseClient): Promise<OrderRow[]> {
  const { data } = await sb
    .from('orders')
    .select(`
      id, status, total_amount, created_at, service_type, is_emergency, customer_id,
      customer:profiles!orders_customer_id_fkey ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  return (data ?? []).map((r) => {
    const row = r as {
      id: string; status: string; total_amount: unknown;
      created_at: string; service_type: unknown; is_emergency: unknown; customer_id: unknown;
      customer: Array<{ full_name: string }> | null;
    };
    return {
      id:            row.id,
      status:        row.status,
      total_amount:  row.total_amount != null ? Number(row.total_amount) : null,
      created_at:    row.created_at,
      service_type:  row.service_type != null ? String(row.service_type) : null,
      is_emergency:  row.is_emergency != null ? Boolean(row.is_emergency) : null,
      /* FK join returns array — access [0] */
      customer_name: row.customer?.[0]?.full_name ?? null,
    };
  });
}

/* ── Route handler ───────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const sb = auth.ctx.supabase;

  /* Time windows */
  const todayISO    = daysAgoISO(0);  // midnight today
  const weekAgoISO  = daysAgoISO(7);
  const twoWeekISO  = daysAgoISO(14);

  /* ── 15 parallel DB calls — isolated so one bad table can't crash the rest ── */
  const [
    totalOrders,
    todayOrders,
    prevWeekOrders,
    totalRevenue,
    revenueToday,
    revenuePrevWeek,
    activeJobs,
    emergencyToday,
    totalCustomers,
    newCustomersWeek,
    totalTechnicians,
    onlineTechnicians,
    pendingKyc,
    fraudFlags,
  ] = await Promise.all([
    safe(sb.from('orders').select('*', { count: 'exact', head: true })),
    safe(sb.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayISO)),
    safe(sb.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', twoWeekISO).lt('created_at', weekAgoISO)),
    safe(sb.from('orders').select('total_amount').eq('status', 'COMPLETED')),
    safe(sb.from('orders').select('total_amount').eq('status', 'COMPLETED').gte('created_at', todayISO)),
    safe(sb.from('orders').select('total_amount').eq('status', 'COMPLETED').gte('created_at', twoWeekISO).lt('created_at', weekAgoISO)),
    safe(sb.from('orders').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'ASSIGNED', 'IN_PROGRESS'])),
    safe(sb.from('orders').select('*', { count: 'exact', head: true }).eq('is_emergency', true).gte('created_at', todayISO)),
    safe(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer')),
    safe(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer').gte('created_at', weekAgoISO)),
    safe(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician')),
    safe(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician').eq('is_online', true)),
    safe(sb.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safe(sb.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('resolved', false)),
  ]);

  /* Chart data + top suppliers + recent orders in parallel */
  const [ordersDaily, revenueDaily, topSuppliers, recentOrders] = await Promise.all([
    buildDailyOrders(sb, 7),
    buildDailyRevenue(sb, 7),
    buildTopSuppliers(sb),
    fetchRecentOrders(sb),
  ]);

  /* Revenue sums */
  const totalRev    = revSum(totalRevenue.data  as Array<{ total_amount: unknown }> | null);
  const revToday    = revSum(revenueToday.data  as Array<{ total_amount: unknown }> | null);
  const revPrevWeek = revSum(revenuePrevWeek.data as Array<{ total_amount: unknown }> | null);

  const payload = {
    kpis: {
      total_orders:       totalOrders.count,
      todays_orders:      todayOrders.count,
      orders_wow_growth:  growth(todayOrders.count, prevWeekOrders.count),
      total_revenue:      totalRev,
      revenue_today:      revToday,
      revenue_wow_growth: growth(revToday, revPrevWeek),
      active_jobs:        activeJobs.count,
      emergency_bookings: emergencyToday.count,
      total_customers:    totalCustomers.count,
      new_customers_week: newCustomersWeek.count,
      total_technicians:  totalTechnicians.count,
      online_technicians: onlineTechnicians.count,
      pending_kyc:        pendingKyc.count,
      fraud_alerts:       fraudFlags.count,
    },
    recent_orders:  recentOrders,
    top_suppliers:  topSuppliers,
    charts: {
      orders_daily:  ordersDaily,
      revenue_daily: revenueDaily,
    },
    meta: {
      generated_at: new Date().toISOString(),
      period:       'last_7_days',
    },
  };

  return NextResponse.json(
    { ok: true, data: payload },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=0, stale-while-revalidate=15' },
    }
  );
}