import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { releaseTechnicianAssignment } from '@/lib/dispatch';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;

  const { data: order, error } = await auth.ctx.supabase
    .from('orders')
    .select('id, technician_id, status')
    .eq('id', id)
    .maybeSingle();

  if (error || !order) return jsonErr('Job not found', 404);
  if (order.technician_id !== auth.ctx.profile.id) return jsonErr('Forbidden', 403);
  if (order.status !== 'ASSIGNED') {
    return jsonErr('Only an unaccepted job can be declined', 409);
  }

  const result = await releaseTechnicianAssignment(
    id,
    auth.ctx.profile.id,
    'REJECTED',
  );

  if (!result.released) {
    return jsonErr('Job could not be released safely', 409);
  }

  return jsonOk({
    released: true,
    reassigned: result.reassigned,
  });
}
