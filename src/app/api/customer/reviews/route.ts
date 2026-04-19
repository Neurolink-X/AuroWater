import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const order_id = typeof body.order_id === 'string' ? body.order_id : '';
  const rating = Number(body.rating);
  const comment =
    typeof body.comment === 'string'
      ? body.comment
      : typeof body.text === 'string'
        ? body.text
        : null;

  if (!order_id || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return jsonErr('order_id and rating (1–5) are required', 400);
  }

  const { data: ord, error: oErr } = await auth.ctx.supabase
    .from('orders')
    .select('id, status, customer_id')
    .eq('id', order_id)
    .maybeSingle();

  if (oErr || !ord) {
    return jsonErr('Order not found', 404);
  }
  if (ord.customer_id !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }
  if (ord.status !== 'COMPLETED') {
    return jsonErr('You can only review completed orders', 400);
  }

  const { data: existing } = await auth.ctx.supabase
    .from('reviews')
    .select('id')
    .eq('order_id', order_id)
    .eq('customer_id', auth.ctx.profile.id)
    .maybeSingle();

  let rev:
    | { id: string; rating: number; created_at: string }
    | null = null;
  if (existing?.id) {
    const { data, error } = await auth.ctx.supabase
      .from('reviews')
      .update({ rating, comment })
      .eq('id', existing.id)
      .select('id, rating, created_at')
      .single();
    if (error) {
      return jsonErr(error.message, 400);
    }
    rev = data;
  } else {
    const { data, error } = await auth.ctx.supabase
      .from('reviews')
      .insert({
        order_id,
        customer_id: auth.ctx.profile.id,
        rating,
        comment,
      })
      .select('id, rating, created_at')
      .single();
    if (error) {
      return jsonErr(error.message, 400);
    }
    rev = data;
  }

  await auth.ctx.supabase.from('orders').update({ has_review: true }).eq('id', order_id);

  return jsonOk(
    {
      id: rev.id,
      rating: rev.rating,
      created_at: rev.created_at,
    },
    201
  );
}
