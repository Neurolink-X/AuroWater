import { NextRequest } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/**
 * Legacy direct status endpoint is intentionally disabled.
 * Use /api/technician/jobs/[id], which enforces assignment checks,
 * customer service OTP verification and payment confirmation.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);
  return jsonErr('Direct status changes are disabled. Use the secure job workflow.', 410);
}
