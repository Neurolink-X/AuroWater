import { NextResponse } from 'next/server';

import { createServiceClient } from '@/utils/supabase/server';

type StatsResponse = {
  completed_orders: number;
  total_customers: number;
  active_suppliers: number;
};

export async function GET() {
  try {
    const sb = createServiceClient();

    const [completedRes, customersRes, suppliersRes] = await Promise.all([
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'supplier')
        .eq('status', 'active'),
    ]);

    const completed_orders = completedRes.count ?? 0;
    const total_customers = customersRes.count ?? 0;
    const active_suppliers = suppliersRes.count ?? 0;

    const body: StatsResponse = { completed_orders, total_customers, active_suppliers };

    return NextResponse.json(body, {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (e: unknown) {
    // Still cache briefly to avoid hammering on repeated failures.
    return NextResponse.json(
      { completed_orders: 0, total_customers: 0, active_suppliers: 0 },
      { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  }
}

