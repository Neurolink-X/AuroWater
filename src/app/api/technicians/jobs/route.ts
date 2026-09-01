import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/** Legacy list — technician orders from Supabase. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '20') || 20));
  const offset = (page - 1) * limit;

  let q = auth.ctx.supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('technician_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq('status', status);

  const { data, error, count } = await q;
  if (error) return jsonErr(error.message, 502);

  const total = count ?? 0;
  return jsonOk({
    data: data ?? [],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

/** Accept job — assigns technician if order is PENDING. */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);

  let body: { order_id?: string };
  try {
    body = (await req.json()) as { order_id?: string };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const orderId = body.order_id?.trim();
  if (!orderId) return jsonErr('order_id is required', 400);

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .update({
      technician_id: auth.ctx.profile.id,
      status: 'ASSIGNED',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'PENDING')
    .select('*')
    .maybeSingle();

  if (error) return jsonErr(error.message, 502);
  if (!data) return jsonErr('Order not found or not available', 404);
  return jsonOk(data);
}
