import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

function formatAddressSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const o = snapshot as Record<string, unknown>;
  const parts = [o.house_flat, o.area, o.city, o.pincode, o.landmark]
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => (x as string).trim());
  return parts.join(', ');
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(_req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;
  const sb = auth.ctx.supabase;

  const { data: order, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!order) {
    return jsonErr('Order not found', 404);
  }

  const row = order as Record<string, unknown>;
  const customerId = row.customer_id != null ? String(row.customer_id) : '';
  const technicianId = row.technician_id != null ? String(row.technician_id) : '';

  let customer_name: string | null = null;
  let customer_phone: string | null = null;
  if (customerId) {
    const { data: c } = await sb.from('profiles').select('full_name, phone').eq('id', customerId).maybeSingle();
    customer_name = c?.full_name != null ? String(c.full_name) : null;
    customer_phone = c?.phone != null ? String(c.phone) : null;
  }

  let technician_name: string | null = null;
  let technician_phone: string | null = null;
  if (technicianId) {
    const { data: t } = await sb.from('profiles').select('full_name, phone').eq('id', technicianId).maybeSingle();
    technician_name = t?.full_name != null ? String(t.full_name) : null;
    technician_phone = t?.phone != null ? String(t.phone) : null;
  }

  let service_name: string | null = null;
  let service_key: string | null = null;
  if (row.service_type_id != null) {
    const { data: st } = await sb
      .from('service_types')
      .select('key, name')
      .eq('id', row.service_type_id as number)
      .maybeSingle();
    if (st?.name != null) service_name = String(st.name);
    if (st?.key != null) service_key = String(st.key);
  }

  const flatAddress = typeof row.address === 'string' && row.address.trim() ? String(row.address).trim() : '';
  const address_text = flatAddress || formatAddressSnapshot(row.address_snapshot);

  return jsonOk({
    ...order,
    customer_name,
    customer_phone,
    technician_name,
    technician_phone,
    service_name,
    service_key,
    address_text,
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const allowed = [
    'status',
    'supplier_id',
    'technician_id',
    'scheduled_date',
    'time_slot',
    'payment_status',
    'notes',
    'total_amount',
    'base_amount',
    'gst_amount',
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = body[k];
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonErr('No updatable fields provided', 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Order not found', 404);
  }

  return jsonOk(data);
}
