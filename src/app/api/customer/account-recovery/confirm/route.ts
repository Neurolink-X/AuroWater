import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { UUID_PATTERN } from '@/lib/account-recovery/shared';

/**
 * A customer's authenticated confirmation is evidence of restored account access.
 * The request/reference number alone grants NO access or authority.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'customer') return jsonErr('Customer sign-in is required.', 403);

  let input: unknown;
  try { input = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
  const parsed = z.object({
    request_id: z.string().regex(UUID_PATTERN),
    confirmed: z.literal(true),
  }).strict().safeParse(input);
  if (!parsed.success) return jsonErr('Choose a valid request and confirm you can access your account.', 422);

  const db = createServiceClient();
  const id = parsed.data.request_id;
  const { data: ticket, error } = await db.from('account_recovery_requests')
    .select('id,user_id,status,ownership_verified_at')
    .eq('id', id).maybeSingle();
  if (error) return jsonErr('Account recovery is temporarily unavailable.', 503);
  if (!ticket || ticket.user_id !== auth.ctx.user.id) return jsonErr('Recovery request not found.', 404);
  if (['resolved', 'rejected'].includes(String(ticket.status))) return jsonErr('This request is already closed.', 409);
  if (!ticket.ownership_verified_at) return jsonErr('Independent ownership verification is required first.', 409);

  const { data: existing, error: historyError } = await db.from('account_recovery_audit')
    .select('id').eq('request_id', id).eq('action', 'customer_recovery_confirmed').limit(1);
  if (historyError) return jsonErr('Verification history is temporarily unavailable.', 503);
  if (existing?.length) return jsonOk({ confirmed: true, already_recorded: true });

  const { error: writeError } = await db.from('account_recovery_audit').insert({
    request_id: id,
    actor_user_id: auth.ctx.user.id,
    action: 'customer_recovery_confirmed',
    details: { channel: 'authenticated_account_session', confirmed_access: true },
  });
  if (writeError) return jsonErr('Could not record your confirmation. Please try again.', 503);
  const response = jsonOk({ confirmed: true, message: 'Your confirmation was recorded. Support will finish reviewing the request.' });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
