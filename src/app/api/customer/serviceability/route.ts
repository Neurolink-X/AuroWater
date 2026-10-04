import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { resolveServiceability } from '@/lib/zones';

/**
 * GET /api/customer/serviceability?address_id=...&service=water_can
 * The server loads the customer's own address, so the result cannot be spoofed from the browser.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const sp = new URL(req.url).searchParams;
  const addressId = sp.get('address_id') ?? '';
  const service = sp.get('service') ?? undefined;
  if (!addressId) return jsonErr('address_id is required', 400);

  const { data: addr, error } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('id', addressId)
    .eq('customer_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    console.error('[serviceability] address lookup failed:', error);
    return jsonErr('Could not check this address right now', 500);
  }
  if (!addr) return jsonErr('Address not found', 404);

  const result = await resolveServiceability(addr as Record<string, unknown>, service);
  return jsonOk(result);
}
