import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { UUID_PATTERN } from '@/lib/account-recovery/shared';
import { createServiceClient } from '@/utils/supabase/server';
import { createSupabaseAnonClient } from '@/lib/db/supabase-server';
import { getSiteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Admin-only, rate-limited, request-specific password reset to the REGISTERED email.
 * Never mail a user-provided alternative address or expose a reset token to the admin.
 * Sending a link does not verify identity and must not automatically close the case.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Forbidden', 403);

  let payload: unknown;
  try { payload = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return jsonErr('Invalid request.', 400);
  const requestId = (payload as Record<string, unknown>).request_id;
  if (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)) return jsonErr('Invalid request ID.', 422);

  try {
    const db = createServiceClient();
    const { data: ticket, error } = await db.from('account_recovery_requests')
      .select('id,user_id,contact_email,category,status').eq('id', requestId).maybeSingle();
    if (error) return jsonErr('Could not load the recovery ticket.', 503);
    if (!ticket) return jsonErr('Request not found.', 404);
    if (['resolved','rejected'].includes(String(ticket.status))) return jsonErr('The request is already closed.', 409);
    if (!['forgot_password','account_access'].includes(String(ticket.category))) {
      return jsonErr('This category requires manual identity verification and a separate approved recovery process.', 422);
    }

    // An anonymous caller can submit somebody else's email. This lookup is NOT proof of ownership.
    // It is safe to initiate a normal recovery only to the actual account's registered inbox.
    const target = String(ticket.contact_email ?? '').trim().toLowerCase();
    const { data: matches, error: profileError } = ticket.user_id
      ? await db.from('profiles').select('email').eq('id', ticket.user_id).limit(1)
      : await db.from('profiles').select('email').ilike('email', target.replace(/[\\%_]/g, '\\$&')).limit(1);
    if (profileError) return jsonErr('Could not check registered recovery email.', 503);
    const registeredEmail = String(matches?.[0]?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(registeredEmail) ||
        registeredEmail.endsWith('@users.aurotap.in')) {
      return jsonErr('No deliverable registered email. Use the independently verified manual recovery path.', 422);
    }

    const secret = process.env.ACCOUNT_RECOVERY_RATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return jsonErr('Secure recovery is not configured.', 503);
    const keyHash = createHmac('sha256', secret).update('admin-reset:' + requestId).digest('hex');
    const { data: limited, error: limitError } = await db.rpc('consume_account_recovery_rate_limit', {
      p_key_hash: keyHash, p_max: 3, p_window_seconds: 3600,
    });
    const quota = Array.isArray(limited) ? limited[0] : limited;
    if (limitError || !quota) return jsonErr('Reset rate-limit verification unavailable.', 503);
    if (!quota.allowed) return jsonErr('This request has reached its reset-email limit. Try again later.', 429);

    const origin = (process.env.NEXT_PUBLIC_APP_URL?.trim() || getSiteUrl()).replace(/\/$/, '');
    const sb = createSupabaseAnonClient();
    const { error: resetError } = await sb.auth.resetPasswordForEmail(registeredEmail, {
      redirectTo: origin + '/auth/update-password',
    });
    if (resetError) {
      console.error('[admin/account-recovery/reset] delivery failed', resetError.message);
      return jsonErr('The reset email could not be requested. Check the email provider configuration.', 503);
    }

    const { error: auditError } = await db.from('account_recovery_audit').insert({
      request_id: requestId, actor_user_id: auth.ctx.user.id,
      action: 'registered_email_reset_requested',
      details: { category: ticket.category, delivery: 'registered_email_only' },
    });
    if (auditError) console.error('[admin/account-recovery/reset] audit write failed', auditError.code);
    return jsonOk({ requested: true, message: 'Reset instructions requested for the registered inbox. Customer confirmation is still required.' });
  } catch (error) {
    console.error('[admin/account-recovery/reset] failed', error instanceof Error ? error.message : 'unknown');
    return jsonErr('Secure recovery is temporarily unavailable.', 503);
  }
}
