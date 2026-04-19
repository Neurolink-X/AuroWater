import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const { data: rows, error } = await auth.ctx.supabase
    .from('orders')
    .select('total_amount, status, payment_status')
    .eq('technician_id', auth.ctx.profile.id);

  if (error) {
    return jsonErr(error.message, 500);
  }

  const completed = (rows ?? []).filter((o) => o.status === 'COMPLETED');
  const gross = completed.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  return jsonOk({
    completed_jobs: completed.length,
    gross_total: gross,
    note: 'Net settlement rules are applied by admin finance.',
  });
}
