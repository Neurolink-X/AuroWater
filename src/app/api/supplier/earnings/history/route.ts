import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '20') || 20, 100);
  const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

  const { data, error } = await auth.ctx.supabase
    .from('payouts')
    .select('*')
    .eq('supplier_id', auth.ctx.profile.id)
    .order('paid_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return jsonErr(error.message, 500);
  }

  return jsonOk(data ?? []);
}
